# hardware/imu/wt901c.py
#!/usr/bin/env python3
"""
WT901C-TTL (WitMotion) binary protocol driver.

- Uses the 0x55-framed binary stream with packet IDs:
  0x50 (time), 0x51 (accel), 0x52 (gyro), 0x53 (angles),
  0x54 (mag), 0x55 (port status), 0x56 (pressure/alt), 0x57 (gps),
  0x58 (gps-acc), 0x59 (quaternion), 0x5A (dport)

- Provides:
  * Threaded reader with callback
  * Blocking read() that yields parsed packets
  * Convenience commands: save, reset, set rate, set baud, start/stop calib
  * Generic register write (for advanced config)
  * (NEW) Orientation utilities:
      - Built-in dish mounting matrix (Sensor→Body): Forward=Zs, Right=Xs, Up=Ys
      - Tilt-compensated magnetic heading + true heading (declination applied)
      - Cross-level (roll about boresight) and Elevation (pitch about right axis)
      - Reference heading offset (to make "this pose = 0°")
      - Declination management: manual set or auto-update from GPS via a provider

Scaling (typical WitMotion series firmware):
  ACC:  raw/32768 * 16 g
  GYRO: raw/32768 * 2000 deg/s
  ANG:  raw/32768 * 180 deg
  MAG:  raw (LSB as provided)
  QUAT: raw/32768 (unit quaternion)

If your device uses different scales, adjust SCALE_* below.
"""

from __future__ import annotations

import threading
import time
import struct
import math
from dataclasses import dataclass, asdict
from enum import IntEnum
from typing import Callable, Optional, Union, Tuple, Dict, Any
from datetime import datetime, timezone

import serial

# ---------- Protocol & scaling ----------

FRAME_HEAD = 0x55

class PID(IntEnum):
    TIME = 0x50
    ACC  = 0x51
    GYRO = 0x52
    ANG  = 0x53
    MAG  = 0x54
    PORT = 0x55
    BARO = 0x56
    GPS  = 0x57
    GPS2 = 0x58
    QUAT = 0x59
    DPORT= 0x5A

# Typical WT901 scales (adjust if your firmware differs)
SCALE_ACC_G      = 16.0 / 32768.0           # g
SCALE_GYRO_DPS   = 2000.0 / 32768.0         # deg/sec
SCALE_ANGLE_DEG  = 180.0 / 32768.0          # deg
SCALE_QUAT       = 1.0 / 32768.0            # unitless
SCALE_PRESSURE_Pa= 1.0                      # device dependent
SCALE_ALT_M      = 0.01                     # device dependent

# ---------- Data containers ----------

@dataclass
class Accel:
    ax_g: float
    ay_g: float
    az_g: float
    temp_c: float

@dataclass
class Gyro:
    gx_dps: float
    gy_dps: float
    gz_dps: float
    temp_c: float

@dataclass
class Angles:
    roll_deg: float
    pitch_deg: float
    yaw_deg: float
    temp_c: float

@dataclass
class Mag:
    mx: int
    my: int
    mz: int
    temp_c: float

@dataclass
class TimePacket:
    year: int
    month: int
    day: int
    hour: int
    minute: int
    second: int
    millis: int

@dataclass
class Quaternion:
    q0: float
    q1: float
    q2: float
    q3: float

@dataclass
class PressureAlt:
    pressure_pa: float
    altitude_m: float

@dataclass
class GPSData:
    """GPS position data (0x57)"""
    lon_deg: float      # Longitude in degrees
    lat_deg: float      # Latitude in degrees
    gps_height_m: float # GPS altitude in meters
    gps_yaw_deg: float  # GPS heading in degrees
    ground_speed_kmh: float  # Ground speed in km/h

@dataclass
class GPSAccuracy:
    """GPS accuracy data (0x58)"""
    pdop: float         # Position dilution of precision
    hdop: float         # Horizontal dilution of precision
    vdop: float         # Vertical dilution of precision
    num_satellites: int # Number of satellites

@dataclass
class PortStatus:
    """Digital port status (0x5A)"""
    d0: int
    d1: int
    d2: int
    d3: int

Packet = Union[Accel, Gyro, Angles, Mag, TimePacket, Quaternion, PressureAlt, GPSData, GPSAccuracy, PortStatus]

# ---------- NEW: Orientation result ----------

@dataclass
class Orientation:
    """Computed orientation fields in the DISH BODY frame."""
    heading_mag_deg: float
    heading_true_deg: float
    cross_level_deg: float   # roll about boresight (X_body); ~±10° in your mech
    elevation_deg: float     # pitch about right axis (Y_body); positive up
    declination_deg: float   # east positive
    declination_source: str  # "manual" | "auto"
    declination_timestamp_utc: Optional[str]  # ISO8601 or None
    heading_offset_deg: float

# ---------- Exceptions ----------

class WT901Error(Exception): ...
class WT901ChecksumError(WT901Error): ...
class WT901ProtocolError(WT901Error): ...

# ---------- Helper: checksum ----------

def checksum8(data: bytes) -> int:
    """Sum of bytes (uint8). For 0x55 frames, the last byte equals sum of 10 previous bytes."""
    return sum(data) & 0xFF

# ---------- Parser for 0x55 frames ----------

def _to_i16(b: bytes) -> int:
    return struct.unpack("<h", b)[0]

def _to_u16(b: bytes) -> int:
    return struct.unpack("<H", b)[0]

def _to_i32(b: bytes) -> int:
    return struct.unpack("<i", b)[0]

def _parse_payload(pid: int, payload: bytes) -> Optional[Packet]:
    # payload is 9 bytes (little-endian shorts/ints)
    if pid == PID.ACC:
        ax = _to_i16(payload[0:2]) * SCALE_ACC_G
        ay = _to_i16(payload[2:4]) * SCALE_ACC_G
        az = _to_i16(payload[4:6]) * SCALE_ACC_G
        t  = _to_i16(payload[6:8]) / 100.0
        return Accel(ax, ay, az, t)

    if pid == PID.GYRO:
        gx = _to_i16(payload[0:2]) * SCALE_GYRO_DPS
        gy = _to_i16(payload[2:4]) * SCALE_GYRO_DPS
        gz = _to_i16(payload[4:6]) * SCALE_GYRO_DPS
        t  = _to_i16(payload[6:8]) / 100.0
        return Gyro(gx, gy, gz, t)

    if pid == PID.ANG:
        roll  = _to_i16(payload[0:2]) * SCALE_ANGLE_DEG
        pitch = _to_i16(payload[2:4]) * SCALE_ANGLE_DEG
        yaw   = _to_i16(payload[4:6]) * SCALE_ANGLE_DEG
        t     = _to_i16(payload[6:8]) / 100.0
        return Angles(roll, pitch, yaw, t)

    if pid == PID.MAG:
        mx = _to_i16(payload[0:2])
        my = _to_i16(payload[2:4])
        mz = _to_i16(payload[4:6])
        t  = _to_i16(payload[6:8]) / 100.0
        return Mag(mx, my, mz, t)

    if pid == PID.TIME:
        # Year(2B) Month Day Hour Minute Second ms(2B)
        year   = _to_u16(payload[0:2])
        month  = payload[2]
        day    = payload[3]
        hour   = payload[4]
        minute = payload[5]
        second = payload[6]
        millis = _to_u16(payload[7:9])
        return TimePacket(year, month, day, hour, minute, second, millis)

    if pid == PID.QUAT:
        q0 = _to_i16(payload[0:2]) * SCALE_QUAT
        q1 = _to_i16(payload[2:4]) * SCALE_QUAT
        q2 = _to_i16(payload[4:6]) * SCALE_QUAT
        q3 = _to_i16(payload[6:8]) * SCALE_QUAT
        return Quaternion(q0, q1, q2, q3)

    if pid == PID.BARO:
        pressure = _to_i32(payload[0:4]) * SCALE_PRESSURE_Pa
        alt_m    = _to_i32(payload[4:8]) * SCALE_ALT_M
        return PressureAlt(pressure, alt_m)

    if pid == PID.GPS:
        # GPS data layout varies by model; keep basic fields so APIs compile.
        lon_raw = _to_i32(payload[0:4])
        lat_raw = _to_i32(payload[4:8])
        lon_deg = lon_raw / 1e7
        lat_deg = lat_raw / 1e7
        return GPSData(lon_deg, lat_deg, 0.0, 0.0, 0.0)

    if pid == PID.GPS2:
        pdop = _to_u16(payload[0:2]) / 100.0
        hdop = _to_u16(payload[2:4]) / 100.0
        vdop = _to_u16(payload[4:6]) / 100.0
        nsats = _to_u16(payload[6:8])
        return GPSAccuracy(pdop, hdop, vdop, nsats)

    if pid == PID.DPORT:
        d0 = _to_u16(payload[0:2])
        d1 = _to_u16(payload[2:4])
        d2 = _to_u16(payload[4:6])
        d3 = _to_u16(payload[6:8])
        return PortStatus(d0, d1, d2, d3)

    return None

def parse_frame(frame11: bytes) -> Tuple[PID, Optional[Packet]]:
    """Parse an 11-byte 0x55 frame: [0]=0x55, [1]=pid, [2:10]=payload(9B), [10]=sum."""
    if len(frame11) != 11 or frame11[0] != FRAME_HEAD:
        raise WT901ProtocolError("Bad frame header/length")
    if checksum8(frame11[0:10]) != frame11[10]:
        raise WT901ChecksumError("Checksum mismatch")
    pid = frame11[1]
    payload = frame11[2:11-1]
    pkt = _parse_payload(pid, payload)
    return PID(pid), pkt

# ---------- Command helpers (register writes) ----------

def cmd_frame(cmd: int, arg: int) -> bytes:
    """
    Many WitMotion commands use: 0xFF 0xAA <cmd> <arg>
    (Some use longer sequences; for those, use write_register_raw.)
    """
    return bytes([0xFF, 0xAA, cmd & 0xFF, arg & 0xFF])

# Common command IDs (seen across WT901 variants; may vary by firmware)
CMD_SAVE           = 0x00  # arg=0x00
CMD_CAL_ACCEL      = 0x01  # arg: 0x01 start, 0x00 stop
CMD_OUTPUT_CONTENT = 0x02  # arg: bitmask of output packets
CMD_SET_RATE       = 0x03  # arg: Hz code (2=2Hz, 10=10Hz, 100=100Hz, etc.)
CMD_SET_BAUD       = 0x04  # arg: code (0=9600,1=19200,2=38400,3=57600,4=115200)
CMD_AXIS_DIR       = 0x05  # arg: installation direction code
CMD_RESET          = 0x06  # arg: 0x00
CMD_CAL_MAG        = 0x07  # arg: 0x01 start, 0x00 stop
CMD_READ_REG       = 0x27  # Read register (special format)
CMD_UNLOCK         = 0x69  # Unlock config (arg=0x88, followed by 0xB5)
CMD_LOCK           = 0x6A  # Lock config (arg=0xB5, followed by 0x88)

# Unlock/Lock sequences (5 bytes each)
SEQ_UNLOCK = bytes([0xFF, 0xAA, 0x69, 0x88, 0xB5])
SEQ_LOCK   = bytes([0xFF, 0xAA, 0x6A, 0xB5, 0x88])

# Installation direction codes for CMD_AXIS_DIR
AXIS_DIR_HORIZONTAL = 0x00  # Default horizontal installation
AXIS_DIR_VERTICAL   = 0x01  # Vertical installation

# ---------- Driver ----------

class WT901C:
    """
    WT901C-TTL driver.
    - Start the reader thread with .start() and stop with .stop()
    - Use .read() to get next parsed packet (blocking with timeout)
    - Register callbacks with on_packet()

    Declination handling (for TRUE heading)
    --------------------------------------
    - Set manually with `set_declination_deg(value_deg)`.
    - Or enable GPS-driven updates with:
         set_declination_provider(provider_fn)
         update_declination_from_gps(lat, lon, alt_m=0, dt=None)
      where `provider_fn(lat, lon, alt_m, dt)->deg` returns declination
      (east positive). The provider typically wraps a WMM/IGRF model. This
      library **does not** impose any extra dependency; you may plug in your
      own function. If no provider is set, `update_declination_from_gps()` is a no-op.

    Mounting (Sensor→Dish body)
    ---------------------------
    This class applies the dish mapping by default:
        Body.Forward (Xb) = Sensor.Zs
        Body.Right   (Yb) = Sensor.Xs
        Body.Up      (Zb) = Sensor.Ys
    Use `set_mount_matrix()` if you ever change mechanical mounting.

    Reference heading offset
    ------------------------
    Use `set_heading_offset_deg(off)` to make the current pose read ~0°.
    You can compute an offset by averaging a few seconds at your "North"
    pose, then set offset = -magnetic_heading (wrapped to 0..360).
    """

    # ---------------- NEW: static helpers (mount) ----------------
    _R_MOUNT_DEFAULT = (
        (0.0, 0.0, 1.0),  # X_body from [Xs,Ys,Zs]
        (1.0, 0.0, 0.0),  # Y_body
        (0.0, 1.0, 0.0),  # Z_body
    )

    @staticmethod
    def _mul_Rv(R: Tuple[Tuple[float,float,float], ...], v: Tuple[float,float,float]) -> Tuple[float,float,float]:
        return (
            R[0][0]*v[0] + R[0][1]*v[1] + R[0][2]*v[2],
            R[1][0]*v[0] + R[1][1]*v[1] + R[1][2]*v[2],
            R[2][0]*v[0] + R[2][1]*v[1] + R[2][2]*v[2],
        )

    @staticmethod
    def _norm_deg(a: float) -> float:
        a %= 360.0
        return a if a >= 0 else a + 360.0

    # -------------------------------------------------------------

    def __init__(self, port: str, baud: int = 115200, timeout: float = 0.2):
        self._ser = serial.Serial(port=port, baudrate=baud, timeout=timeout)
        self._rx = bytearray()
        self._running = False
        self._th: Optional[threading.Thread] = None
        self._cb: Optional[Callable[[PID, Optional[Packet]], None]] = None
        self._last: Dict[PID, Packet] = {}
        self._lock = threading.Lock()

        # NEW: orientation/declination state
        self._R_mount = WT901C._R_MOUNT_DEFAULT
        self._heading_offset_deg: float = 0.0
        self._declination_deg: float = 0.0
        self._declination_src: str = "manual"   # "manual" | "auto"
        self._declination_ts: Optional[datetime] = None
        self._declination_provider = None  # callable or None

    # ---- lifecycle ----

    def start(self) -> "WT901C":
        if self._running:
            return self
        self._running = True
        self._th = threading.Thread(target=self._reader, name="WT901CReader", daemon=True)
        self._th.start()
        return self

    def stop(self) -> "WT901C":
        self._running = False
        return self

    def close(self):
        try:
            self._ser.close()
        except Exception:
            pass

    # ---- callbacks / state ----

    def on_packet(self, cb: Callable[[PID, Optional[Packet]], None]) -> None:
        """Register a callback invoked for each valid parsed packet."""
        self._cb = cb

    def last(self, pid: PID) -> Optional[Packet]:
        with self._lock:
            return self._last.get(pid)

    # ---- reading ----

    def read(self, timeout: float = 1.0) -> Optional[Tuple[PID, Optional[Packet]]]:
        """
        Synchronously read ONE frame (blocks). Use this if you don't want the background thread.
        """
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            f = self._read_one_frame(timeout=max(0.01, self._ser.timeout or 0.05))
            if f is not None:
                return f
        return None

    def _reader(self):
        while self._running:
            try:
                f = self._read_one_frame(timeout=self._ser.timeout or 0.05)
                if f is None:
                    continue
                pid, pkt = f
                with self._lock:
                    if pkt is not None:
                        self._last[pid] = pkt
                if self._cb:
                    try:
                        self._cb(pid, pkt)
                    except Exception:
                        pass
            except Exception:
                # swallow intermittent serial errors; user can stop() to quit
                pass

    def _read_one_frame(self, timeout: float) -> Optional[Tuple[PID, Optional[Packet]]]:
        """
        Accumulate bytes, search for header 0x55, then read 10 more bytes.
        Verify checksum, parse, and return (pid, packet) or None if timeout.
        """
        t_end = time.monotonic() + timeout
        ser = self._ser

        while time.monotonic() < t_end:
            data = ser.read(ser.in_waiting or 1)
            if not data:
                continue
            self._rx += data

            # try to extract frames
            while True:
                # find header
                try:
                    idx = self._rx.index(FRAME_HEAD.to_bytes(1, "little"))
                except ValueError:
                    # no header; keep last few bytes in buffer
                    self._rx = self._rx[-1:]
                    break

                # need 11 bytes from header
                if len(self._rx) - idx < 11:
                    if idx > 0:
                        self._rx = self._rx[idx:]  # trim before header
                    break

                frame = bytes(self._rx[idx:idx+11])
                self._rx = self._rx[idx+11:]  # advance buffer

                try:
                    pid, pkt = parse_frame(frame)
                    return pid, pkt
                except WT901ChecksumError:
                    continue
                except WT901ProtocolError:
                    continue

        return None

    # ---- commands ----

    def write_register(self, cmd: int, arg: int = 0) -> None:
        self._ser.write(cmd_frame(cmd, arg))
        self._ser.flush()

    def write_register_raw(self, data: bytes) -> None:
        """Send an arbitrary command sequence (if your firmware expects longer packets)."""
        self._ser.write(data)
        self._ser.flush()

    def save_config(self) -> None:
        self.write_register(CMD_SAVE, 0x00)

    def reset(self) -> None:
        self.write_register(CMD_RESET, 0x00)

    def start_accel_calibration(self) -> None:
        self.write_register(CMD_CAL_ACCEL, 0x01)

    def stop_accel_calibration(self) -> None:
        self.write_register(CMD_CAL_ACCEL, 0x00)

    def start_mag_calibration(self) -> None:
        self.write_register(CMD_CAL_MAG, 0x01)

    def stop_mag_calibration(self) -> None:
        self.write_register(CMD_CAL_MAG, 0x00)

    def set_output_rate_hz(self, hz: int) -> None:
        """Typical rates: 2–200 Hz (firmware-dependent)."""
        self.write_register(CMD_SET_RATE, max(1, min(200, hz)))

    def set_baud_code(self, code: int) -> None:
        """
        Baud code mapping (typical):
          0=9600, 1=19200, 2=38400, 3=57600, 4=115200.
        After calling this, reopen the port at the new speed.
        """
        self.write_register(CMD_SET_BAUD, max(0, min(4, code)))

    def set_output_content_mask(self, mask: int) -> None:
        """
        Caution: bit meanings vary by firmware; common mapping is:
            bit0=ACC (0x51), bit1=GYRO (0x52), bit2=ANG (0x53), bit3=MAG (0x54),
            bit4=BARO (0x56), bit5=QUAT (0x59)
        """
        self.write_register(CMD_OUTPUT_CONTENT, mask & 0xFF)

    # ---- Advanced configuration (requires unlock) ----

    def unlock(self) -> None:
        """Unlock configuration for writing."""
        self.write_register_raw(SEQ_UNLOCK)
        time.sleep(0.1)

    def lock(self) -> None:
        """Lock configuration to prevent accidental changes."""
        self.write_register_raw(SEQ_LOCK)
        time.sleep(0.1)

    def set_installation_direction(self, direction: int = AXIS_DIR_HORIZONTAL) -> None:
        """Set sensor installation direction/orientation on-device."""
        self.write_register(CMD_AXIS_DIR, direction & 0xFF)

    def set_gyro_auto_calibration(self, enable: bool) -> None:
        """Enable/disable automatic gyroscope calibration on startup."""
        self.write_register(0x63, 0x01 if enable else 0x00)

    def set_angle_reference(self, axis: str = "z") -> None:
        """
        Set current angle as reference (zero point).
        axis: 'x', 'y', 'z', or 'all'
        """
        axis_map = {"x": 0x01, "y": 0x02, "z": 0x04, "all": 0x07}
        mask = axis_map.get(axis.lower(), 0x04)
        self.write_register(0x01, mask)

    def read_register(self, reg_addr: int) -> Optional[bytes]:
        """
        Read a register value (basic form; full 0x5F handler not implemented here).
        """
        cmd = bytes([0xFF, 0xAA, CMD_READ_REG, reg_addr & 0xFF, (reg_addr >> 8) & 0xFF])
        self.write_register_raw(cmd)
        time.sleep(0.1)
        return None

    def calibrate_with_config(self, accel: bool = False, mag: bool = False,
                              angle_ref: Optional[str] = None, duration: float = 10.0) -> None:
        """Perform calibration sequence with automatic unlock/lock."""
        print(f"Starting calibration (duration: {duration}s)...")
        self.unlock()
        time.sleep(0.2)
        try:
            if accel:
                print("  Accelerometer calibration: Keep device STILL on level surface")
                self.start_accel_calibration()
                time.sleep(duration)
                self.stop_accel_calibration()
                print("  Accelerometer calibration complete")
            if mag:
                print("  Magnetometer calibration: Rotate device in ALL directions (figure-8)")
                self.start_mag_calibration()
                time.sleep(duration)
                self.stop_mag_calibration()
                print("  Magnetometer calibration complete")
            if angle_ref:
                print(f"  Setting angle reference: {angle_ref}-axis")
                self.set_angle_reference(angle_ref)
                time.sleep(0.5)
            print("  Saving configuration...")
            self.save_config()
            time.sleep(0.5)
        finally:
            self.lock()
            print("Calibration complete and configuration locked")

    def configure_advanced(self,
                           rate_hz: Optional[int] = None,
                           content_mask: Optional[int] = None,
                           installation_dir: Optional[int] = None,
                           gyro_auto_cal: Optional[bool] = None) -> None:
        """
        Configure multiple advanced settings with automatic unlock/lock.
        """
        self.unlock()
        time.sleep(0.2)
        try:
            if rate_hz is not None:
                self.set_output_rate_hz(rate_hz)
                time.sleep(0.1)
            if content_mask is not None:
                self.set_output_content_mask(content_mask)
                time.sleep(0.1)
            if installation_dir is not None:
                self.set_installation_direction(installation_dir)
                time.sleep(0.1)
            if gyro_auto_cal is not None:
                self.set_gyro_auto_calibration(gyro_auto_cal)
                time.sleep(0.1)
            self.save_config()
            time.sleep(0.5)
        finally:
            self.lock()
            print("Configuration updated and locked")

    # ---------------- NEW: declination + mounting + orientation ----------------

    def set_declination_deg(self, deg: float) -> None:
        """Set magnetic declination in degrees (east positive)."""
        self._declination_deg = float(deg)
        self._declination_src = "manual"
        self._declination_ts = datetime.now(timezone.utc)

    def set_declination_provider(self, provider_fn: Callable[[float,float,float,Optional[datetime]], float]) -> None:
        """
        Register a declination provider:
            provider_fn(lat_deg, lon_deg, alt_m, dt) -> declination_deg (east positive)
        This lets you plug in a WMM/IGRF-backed function without adding
        dependencies here. If not set, GPS updates won't change declination.
        """
        self._declination_provider = provider_fn

    def update_declination_from_gps(self, lat_deg: float, lon_deg: float,
                                    alt_m: float = 0.0, dt: Optional[datetime] = None) -> None:
        """
        Update declination using current GPS fix.
        SAFE NO-OP if no provider was configured via set_declination_provider().
        """
        if not self._declination_provider:
            return
        val = float(self._declination_provider(lat_deg, lon_deg, alt_m, dt))
        self._declination_deg = val
        self._declination_src = "auto"
        self._declination_ts = dt or datetime.now(timezone.utc)

    def get_declination_info(self) -> Tuple[float, str, Optional[str]]:
        """Return (deg, source, timestamp_iso8601)."""
        ts = self._declination_ts.isoformat().replace("+00:00", "Z") if self._declination_ts else None
        return (self._declination_deg, self._declination_src, ts)

    def set_heading_offset_deg(self, offset_deg: float) -> None:
        """
        Set a fixed offset added to magnetic heading (before declination),
        usually chosen so that the current pose reads ~0°.
        """
        self._heading_offset_deg = float(offset_deg)

    def set_mount_matrix(self, R3x3: Tuple[Tuple[float,float,float], ...]) -> None:
        """
        Replace the default Sensor→Body rotation (3x3). Only needed if you change mechanical mounting.
        """
        self._R_mount = R3x3

    @staticmethod
    def _rpy_from_body_acc(ax: float, ay: float, az: float) -> Tuple[float, float]:
        """
        Compute body-frame roll (cross-level) and pitch (elevation basis) from accel.
        roll  = rotation about X_body (boresight)
        pitch = rotation about Y_body (right)
        """
        g = math.sqrt(ax*ax + ay*ay + az*az) or 1.0
        axn, ayn, azn = ax/g, ay/g, az/g
        roll  = math.degrees(math.atan2(ayn, azn))
        pitch = math.degrees(math.atan2(-axn, math.sqrt(ayn*ayn + azn*azn)))
        return roll, pitch

    def _compute_heading_from_latest(self) -> Optional[Tuple[float,float,float,float]]:
        """
        Return (heading_mag, heading_true, cross_level, elevation) if ACC+MAG present, else None.
        Elevation is defined positive when boresight goes up.
        """
        with self._lock:
            acc = self._last.get(PID.ACC)
            mag = self._last.get(PID.MAG)
        if not isinstance(acc, Accel) or not isinstance(mag, Mag):
            return None

        # Sensor→Body
        ax_b, ay_b, az_b = WT901C._mul_Rv(self._R_mount, (acc.ax_g, acc.ay_g, acc.az_g))
        mx_b, my_b, mz_b = WT901C._mul_Rv(self._R_mount, (float(mag.mx), float(mag.my), float(mag.mz)))

        # Cross-level & Elevation from accel (body frame)
        roll_deg, pitch_deg = WT901C._rpy_from_body_acc(ax_b, ay_b, az_b)
        cross_level = roll_deg
        elevation   = -pitch_deg  # positive up

        # Tilt-compensate magnetometer into horizontal plane
        roll = math.radians(roll_deg)
        pitch= math.radians(pitch_deg)
        mx2 =  mx_b * math.cos(pitch) + mz_b * math.sin(pitch)
        my2 = (mx_b * math.sin(roll) * math.sin(pitch)
               + my_b * math.cos(roll)
               - mz_b * math.sin(roll) * math.cos(pitch))

        hdg_mag = math.degrees(math.atan2(-my2, mx2))
        hdg_mag = WT901C._norm_deg(hdg_mag + self._heading_offset_deg)

        hdg_true = WT901C._norm_deg(hdg_mag + self._declination_deg)

        return (hdg_mag, hdg_true, cross_level, elevation)

    def get_orientation(self) -> Optional[Orientation]:
        """
        Compute and return Orientation from latest ACC+MAG.
        Returns None if required packets haven't arrived yet.

        Declination from GPS
        --------------------
        If you want `heading_true_deg` to use GPS-based declination:
        1) Call `imu.set_declination_provider(provider_fn)` once at setup.
           The provider must implement:
              provider_fn(lat_deg, lon_deg, alt_m, dt) -> declination_deg
        2) Whenever your GPS module (e.g., M9N) publishes a fresh fix, call:
              imu.update_declination_from_gps(lat, lon, alt_m, gps_time)
           This updates the internal declination used here.
        """
        vals = self._compute_heading_from_latest()
        if vals is None:
            return None
        hdg_mag, hdg_true, cross_level, elevation = vals
        dec_deg, dec_src, dec_ts = self.get_declination_info()
        return Orientation(
            heading_mag_deg = hdg_mag,
            heading_true_deg= hdg_true,
            cross_level_deg = cross_level,
            elevation_deg   = elevation,
            declination_deg = dec_deg,
            declination_source = dec_src,
            declination_timestamp_utc = dec_ts,
            heading_offset_deg = self._heading_offset_deg,
        )

    def orientation_json(self) -> Optional[Dict[str, Any]]:
        """Same as get_orientation(), but as a dict (safe for telemetry JSON)."""
        o = self.get_orientation()
        return asdict(o) if o else None
