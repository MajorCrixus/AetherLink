#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MKS SERVO57D RS-485 — Python Library (firmware v1.0.6)
Protocol: Native serial frames (NOT Modbus), FA (downlink) / FB (uplink), CHECKSUM-8.

Covers:
- Reads: encoder (carry/addition/raw), speed, pulses, error, EN/zero/protect state, IO, bulk status.
- Config: mode, current, hold current, microstep, EN polarity, DIR, autosleep, stall protect, microstep interp,
          baud, slave address, respond/active, key lock, group addr, home params, nolimit home params, limit remap,
          PID (A1/A2/A3), start/stop acceleration (A4/A5), write-all/read-all params, restore factory, restart.
- Motion: speed mode (F6), rel/abs pulses (FD/FE), rel/abs axis (F4/F5), emergency stop (F7).
- Misc: power-on autorun (FF), version info (40), release protect (3D), read IO (34), write IO (36).

Tested on RPi 4B (Ubuntu) using a WaveShare USB↔RS485 hub.
"""

from __future__ import annotations

import time
import struct
from dataclasses import dataclass
from enum import IntEnum, IntFlag
from typing import Optional, Tuple, Dict

import serial
from serial import Serial


# ===== Constants =====

DEFAULT_BAUD = 38400
DEFAULT_TIMEOUT = 0.25  # seconds

DOWN_HDR = 0xFA  # host -> servo
UP_HDR   = 0xFB  # servo -> host

TICKS_PER_REV = 0x4000  # 16384 axis ticks per 360 degrees


# ===== Enums / Flags =====

class Mode(IntEnum):
    CR_OPEN   = 0
    CR_CLOSE  = 1
    CR_vFOC   = 2
    SR_OPEN   = 3
    SR_CLOSE  = 4
    SR_vFOC   = 5  # commonly used for serial control

class Dir(IntEnum):
    CW  = 0
    CCW = 1

class EnActive(IntEnum):
    ACTIVE_LOW  = 0  # EN low = enabled
    ACTIVE_HIGH = 1  # EN high = enabled
    ALWAYS_ON   = 2  # ignore external EN, hold enabled

class IOFlags(IntFlag):
    IN1  = 1 << 0
    IN2  = 1 << 1
    OUT1 = 1 << 2
    OUT2 = 1 << 3

class StatusF1(IntEnum):
    FAIL         = 0
    STOP         = 1
    SPEED_UP     = 2
    SPEED_DOWN   = 3
    FULL_SPEED   = 4
    HOMING       = 5
    CALIBRATING  = 5  # some docs conflate these


# ===== Data containers =====

@dataclass
class EncoderCarry:
    carry: int     # signed 32-bit wrap counter
    value: int     # 0..0x3FFF (within one revolution)

@dataclass
class HomeParams:
    """0x90 home params block (documented: trigger level, direction, speed, end-limit enable)."""
    hm_trig: int    # 0 = Low, 1 = High
    hm_dir: int     # 0 = CW, 1 = CCW
    hm_speed: int   # 0..3000 (RPM)
    end_limit: int  # 0/1


# ===== Exceptions =====

class MKSProtocolError(Exception): ...
class MKSNoResponse(Exception): ...
class MKSChecksumError(Exception): ...


# ===== Utilities =====

def _checksum8(data: bytes) -> int:
    return sum(data) & 0xFF

def _pack_u16(x: int) -> bytes:
    return struct.pack(">H", x & 0xFFFF)

def _pack_i16(x: int) -> bytes:
    return struct.pack(">h", int(x))

def _pack_u32(x: int) -> bytes:
    return struct.pack(">I", x & 0xFFFFFFFF)

def _pack_i32(x: int) -> bytes:
    return struct.pack(">i", int(x))

def _unpack_u16(b: bytes) -> int:
    return struct.unpack(">H", b)[0]

def _unpack_i16(b: bytes) -> int:
    return struct.unpack(">h", b)[0]

def _unpack_i32(b: bytes) -> int:
    return struct.unpack(">i", b)[0]

def degrees_to_axis_ticks(deg: float) -> int:
    return int(round((deg / 360.0) * TICKS_PER_REV))

def axis_ticks_to_degrees(axis: int) -> float:
    return (axis / TICKS_PER_REV) * 360.0


# ===== Expected reply lengths (defensive defaults) =====
# Note: Many commands ACK with a single status byte (total length 5).
# Reads with payloads have fixed sizes as annotated here. Unknowns fall back to
# a streaming read until a valid checksum boundary is found or timeout occurs.

_EXPECT_LEN: Dict[int, Optional[int]] = {
    0x30: 10,  # carry i32 + value u16 -> 3 + 6 + 1
    0x31: 10,  # addition int48 -> 3 + 6 + 1
-   0x32: 5,   # speed i16
+   0x32: 6,   # speed i16 -> 3 + 2 + 1

-   0x33: 7,   # pulses i32
+   0x33: 8,   # pulses i32 -> 3 + 4 + 1

    0x34: 5,   # IO u8 flags -> 3 + 1 + 1
    0x35: 10,  # raw addition int48 -> 3 + 6 + 1
-   0x39: 7,   # axis error i32
+   0x39: 8,   # axis error i32 -> 3 + 4 + 1

    0x3A: 5,   # EN status u8
    0x3B: 5,   # zero status u8
    0x3D: 5,   # release protect u8
    0x3E: 5,   # protect flag u8
    0x40: None,  # variable
    0x41: 5,   # restart ack u8
    0x46: 5,   # write-all params ack u8
    0x47: None,  # variable
    0x48: None,  # variable
    # ... (rest unchanged)
}



# ===== Driver =====

class MKSServo57D:
    """
    High-level driver for MKS SERVO57D RS485 (v1.0.6).

    IMPORTANT:
      - Many boards can disable serial responses (8C). If replies are off, motion
        commands won't ACK; in that case, consider polling status (F1) or re-enabling responses.
    """

    def __init__(self, port: str, baud: int = DEFAULT_BAUD, timeout: float = DEFAULT_TIMEOUT):
        self.ser: Serial = serial.Serial(port=port, baudrate=baud, timeout=timeout)

    # --- framing ---

    def _frame(self, addr: int, code: int, data: bytes = b"") -> bytes:
        head = bytes([DOWN_HDR, addr & 0xFF, code & 0xFF])
        crc  = _checksum8(head + data) & 0xFF
        return head + data + bytes([crc])

    def _send(self, frame: bytes) -> None:
        self.ser.reset_input_buffer()
        self.ser.write(frame)
        self.ser.flush()

    def _recv(self, expect_code: int, expect_addr: Optional[int]) -> bytes:
        """
        Read one uplink (FB ...) with either a known length or scan-until-checksum-valid.
        """
        # Read header
        hdr = self.ser.read(3)
        if len(hdr) < 3:
            raise MKSNoResponse("Timeout waiting for FB header")
        if hdr[0] != UP_HDR:
            raise MKSProtocolError(f"Bad uplink header: {hdr.hex()}")

        addr = hdr[1]
        code = hdr[2]
        if expect_addr is not None and addr != (expect_addr & 0xFF):
            raise MKSProtocolError(f"Addr mismatch: got {addr:02X}, want {expect_addr:02X}")

        exp = _EXPECT_LEN.get(code)
        if exp is None:
            # Unknown/variable payload — scan for a valid checksum end
            payload = bytearray()
            deadline = time.monotonic() + max(self.ser.timeout or 0.001, 0.05)
            while time.monotonic() < deadline:
                b = self.ser.read(1)
                if not b:
                    break
                payload += b
                if len(payload) >= 1:  # at least checksum exists
                    candidate = hdr + bytes(payload)
                    calc = _checksum8(candidate[:-1]) & 0xFF
                    if candidate[-1] == calc:
                        # If we expected a specific code, enforce:
                        if code != (expect_code & 0xFF):
                            raise MKSProtocolError(f"Fn mismatch: got {code:02X}, expected {expect_code:02X}")
                        return candidate
            raise MKSNoResponse(f"Timed out scanning variable-length reply for code {code:02X}")
        else:
            rest = self.ser.read(exp - 3)
            if len(rest) != exp - 3:
                raise MKSNoResponse(f"Short read for code {code:02X} ({len(rest)}/{exp-3})")
            frame = hdr + rest
            calc  = _checksum8(frame[:-1]) & 0xFF
            if calc != frame[-1]:
                raise MKSChecksumError(f"Checksum mismatch for code {code:02X}: got {frame[-1]:02X} != {calc:02X}")
            if code != (expect_code & 0xFF):
                raise MKSProtocolError(f"Fn mismatch: got {code:02X}, expected {expect_code:02X}")
            return frame

    # --- helpers ---

    @staticmethod
    def _pack_speed_dir(dir_ccw: bool, speed_rpm: int) -> Tuple[int, int]:
        """
        Speed mode (F6) and FD use 2 bytes for speed; bit7 of high byte encodes direction.
        We accept 1..3000 rpm (clamped).
        """
        s = max(0, min(3000, int(speed_rpm)))
        rev_bit = 0x80 if dir_ccw else 0x00
        hi = (s >> 4) & 0x7F
        lo = (s & 0x0F) << 4
        return (rev_bit | hi), lo

    # ===== READS =====

    def _xfer(self, addr: int, code: int, data: bytes = b"", expect_reply: bool = True) -> bytes:
        frame = self._frame(addr, code, data)
        self._send(frame)
        if not expect_reply:
            # Always return bytes (never None) to keep Pylance happy.
            return b""
        return self._recv(expect_code=code, expect_addr=addr)

    def read_encoder_carry(self, addr: int) -> EncoderCarry:
        f = self._xfer(addr, 0x30)
        return EncoderCarry(carry=_unpack_i32(f[3:7]), value=_unpack_u16(f[7:9]))

    def read_encoder_addition(self, addr: int) -> int:
        f = self._xfer(addr, 0x31)
        return int.from_bytes(f[3:9], "big", signed=True)  # 48-bit signed

    def read_raw_addition(self, addr: int) -> int:
        f = self._xfer(addr, 0x35)
        return int.from_bytes(f[3:9], "big", signed=True)

    def read_speed_rpm(self, addr: int) -> int:
        f = self._xfer(addr, 0x32)
        return _unpack_i16(f[3:5])

    def read_pulses(self, addr: int) -> int:
        f = self._xfer(addr, 0x33)
        return _unpack_i32(f[3:7])

    def read_axis_error(self, addr: int) -> int:
        f = self._xfer(addr, 0x39)
        return _unpack_i32(f[3:7])

    def read_en_status(self, addr: int) -> int:
        return self._xfer(addr, 0x3A)[3]

    def read_zero_status(self, addr: int) -> int:
        return self._xfer(addr, 0x3B)[3]

    def read_protect_status(self, addr: int) -> int:
        return self._xfer(addr, 0x3E)[3]

    def read_io(self, addr: int) -> IOFlags:
        return IOFlags(self._xfer(addr, 0x34)[3])

    def read_all_params(self, addr: int) -> bytes:
        f = self._xfer(addr, 0x47)
        return bytes(f[3:-1])  # raw param block

    def read_all_status(self, addr: int) -> bytes:
        f = self._xfer(addr, 0x48)
        return bytes(f[3:-1])  # raw status block

    def read_version_info(self, addr: int) -> bytes:
        """
        0x40: Return hardware/firmware info. Payload format varies by build.
        Return raw payload (bytes) so callers can interpret as needed.
        """
        f = self._xfer(addr, 0x40)
        return bytes(f[3:-1])

    # ===== CONFIG / SETTINGS =====

    def calibrate(self, addr: int) -> int:
        return self._xfer(addr, 0x80, b"\x00")[3]

    def set_motor_type_confirm(self, addr: int, typ: int) -> int:
        """
        0x81 best-effort: Some builds confirm motor type.
        'typ' is a small integer; library simply passes it through.
        """
        return self._xfer(addr, 0x81, bytes([typ & 0xFF]))[3]

    def set_mode(self, addr: int, mode: Mode) -> int:
        return self._xfer(addr, 0x82, bytes([int(mode) & 0xFF]))[3]

    def set_current_ma(self, addr: int, milliamps: int) -> int:
        return self._xfer(addr, 0x83, _pack_u16(milliamps))[3]

    def set_microstep(self, addr: int, microstep: int) -> int:
        return self._xfer(addr, 0x84, bytes([microstep & 0xFF]))[3]

    def set_en_active(self, addr: int, en: EnActive) -> int:
        return self._xfer(addr, 0x85, bytes([int(en) & 0xFF]))[3]

    def set_dir(self, addr: int, d: Dir) -> int:
        return self._xfer(addr, 0x86, bytes([int(d) & 0xFF]))[3]

    def set_autosleep(self, addr: int, enable: bool) -> int:
        return self._xfer(addr, 0x87, bytes([1 if enable else 0]))[3]

    def set_stall_protect(self, addr: int, enable: bool) -> int:
        return self._xfer(addr, 0x88, bytes([1 if enable else 0]))[3]

    def set_microstep_interpolation(self, addr: int, enable: bool) -> int:
        return self._xfer(addr, 0x89, bytes([1 if enable else 0]))[3]

    def set_baud_code(self, addr: int, code: int) -> int:
        """
        Baud code table (common): 1=9600, 2=19200, 3=25000, 4=38400, 5=57600, 6=115200, 7=256000.
        """
        return self._xfer(addr, 0x8A, bytes([code & 0xFF]))[3]

    def set_slave_addr(self, addr: int, new_addr: int) -> int:
        return self._xfer(addr, 0x8B, bytes([new_addr & 0xFF]))[3]

    def set_respond_active(self, addr: int, respond_enable: bool, active_enable: bool) -> int:
        # Many firmwares accept two bytes: respond, active (0/1). Some compress to one; replies still 1 byte.
        data = bytes([1 if respond_enable else 0, 1 if active_enable else 0])
        return self._xfer(addr, 0x8C, data)[3]

    def set_group_addr(self, addr: int, group: int) -> int:
        return self._xfer(addr, 0x8D, bytes([group & 0xFF]))[3]

    def set_modbus_enable(self, addr: int, enable: bool) -> int:
        return self._xfer(addr, 0x8E, bytes([1 if enable else 0]))[3]

    def set_key_lock(self, addr: int, lock: bool) -> int:
        return self._xfer(addr, 0x8F, bytes([1 if lock else 0]))[3]

    def set_home_params(self, addr: int, hm: HomeParams) -> int:
        data = bytes([hm.hm_trig & 1, hm.hm_dir & 1]) + _pack_u16(hm.hm_speed) + bytes([hm.end_limit & 1])
        return self._xfer(addr, 0x90, data)[3]

    def go_home(self, addr: int) -> int:
        """Return code: 0 fail, 1 start, 2 success (varies by build)."""
        return self._xfer(addr, 0x91, b"")[3]

    def set_axis_zero(self, addr: int) -> int:
        return self._xfer(addr, 0x92, b"")[3]

    def set_home_direction(self, addr: int, cw: bool) -> int:
        """Best-effort wrapper for 0x93: some builds expose homing direction directly."""
        return self._xfer(addr, 0x93, bytes([0 if cw else 1]))[3]

    def set_nolimit_home(self, addr: int, reverse_axis_ticks: int, mode: int, hm_ma: int) -> int:
        """
        0x94: Configure homing without limit switches.
        reverse_axis_ticks: how far to rewind (u32)
        mode: 0/1 (implementation-defined)
        hm_ma: homing current (mA, u16)
        """
        data = _pack_u32(reverse_axis_ticks) + bytes([mode & 1]) + _pack_u16(hm_ma)
        return self._xfer(addr, 0x94, data)[3]

    def single_turn_home(self, addr: int) -> int:
        """0x9A: One-turn zeroing (implementation-dependent)."""
        return self._xfer(addr, 0x9A, b"")[3]

    def set_hold_current_percent(self, addr: int, percent_10_to_90: int) -> int:
        """
        0x9B: Hold current; many firmwares map 0..8 -> 10..90 %.
        Pass e.g. 10/20/..90; library converts to index.
        """
        if percent_10_to_90 <= 0:
            idx = 0
        else:
            idx = max(0, min(8, (int(round(percent_10_to_90 / 10)) - 1)))
        return self._xfer(addr, 0x9B, bytes([idx & 0xFF]))[3]

    def set_en_zero_and_pos_protect(self, addr: int, en_zero: bool, pos_protect: bool,
                                    trig_time_ms: int = 0, trig_distance_ticks: int = 0) -> int:
        """
        0x9D best-effort: EN-trigger zero + position error protection.
        Payload layout varies; we send a compact (4B) scheme many builds accept:
          [en_zero:1][pos_protect:1][time: u8 in 10ms][dist: u16 (ticks/axis)]
        If your build expects different, adjust here.
        """
        t = max(0, min(255, int(round(trig_time_ms / 10))))
        dist = max(0, min(0xFFFF, int(trig_distance_ticks)))
        data = bytes([1 if en_zero else 0, 1 if pos_protect else 0, t]) + _pack_u16(dist)
        return self._xfer(addr, 0x9D, data)[3]

    def set_limit_remap(self, addr: int, enable: bool) -> int:
        return self._xfer(addr, 0x9E, bytes([1 if enable else 0]))[3]

    def set_limit_port_polarity(self, addr: int, cw_active_low: bool, ccw_active_low: bool) -> int:
        """
        0x95: Set limit port polarity (v1.0.6).
        cw_active_low: True if CW limit is active-low (pressed=0V)
        ccw_active_low: True if CCW limit is active-low
        """
        cw_val = 0 if cw_active_low else 1
        ccw_val = 0 if ccw_active_low else 1
        return self._xfer(addr, 0x95, bytes([cw_val, ccw_val]))[3]

    def set_limit_port_function(self, addr: int, cw_enable: bool, ccw_enable: bool) -> int:
        """
        0x96: Enable/disable CW and CCW limit switches (v1.0.6).
        """
        return self._xfer(addr, 0x96, bytes([1 if cw_enable else 0, 1 if ccw_enable else 0]))[3]

    def set_zero_return_speed(self, addr: int, speed_rpm: int) -> int:
        """
        0x97: Set speed for zero-return/homing operations (v1.0.6).
        speed_rpm: 0..3000
        """
        return self._xfer(addr, 0x97, _pack_u16(max(0, min(3000, speed_rpm))))[3]

    def set_key_switch_mode(self, addr: int, enable: bool) -> int:
        """
        0x98: Enable/disable front panel key/button (v1.0.6).
        """
        return self._xfer(addr, 0x98, bytes([1 if enable else 0]))[3]

    def set_home_trigger_mode(self, addr: int, mode: int) -> int:
        """
        0x99: Set home trigger mode (v1.0.6).
        mode: 0=level trigger, 1=edge trigger (implementation-dependent)
        """
        return self._xfer(addr, 0x99, bytes([mode & 0xFF]))[3]

    def set_pos_error_threshold(self, addr: int, threshold_ticks: int) -> int:
        """
        0x9C: Set position error protection threshold (v1.0.6).
        threshold_ticks: Maximum allowed position error in axis ticks before triggering protection.
        """
        return self._xfer(addr, 0x9C, _pack_u16(max(0, min(0xFFFF, threshold_ticks))))[3]

    def calibrate_zero_position(self, addr: int) -> int:
        """
        0xCA: Calibrate encoder zero position (v1.0.6).
        Sets current position as the absolute encoder zero reference.
        """
        return self._xfer(addr, 0xCA, b"")[3]

    # PID / accel (A1..A5)
    def set_pos_kp(self, addr: int, kp: int) -> int:  return self._xfer(addr, 0xA1, _pack_u16(kp))[3]
    def set_pos_ki(self, addr: int, ki: int) -> int:  return self._xfer(addr, 0xA2, _pack_u16(ki))[3]
    def set_pos_kd(self, addr: int, kd: int) -> int:  return self._xfer(addr, 0xA3, _pack_u16(kd))[3]
    def set_start_accel(self, addr: int, acc: int) -> int: return self._xfer(addr, 0xA4, bytes([acc & 0xFF]))[3]
    def set_stop_accel(self, addr: int, acc: int) -> int:  return self._xfer(addr, 0xA5, bytes([acc & 0xFF]))[3]

    # bulk params
    def write_all_params(self, addr: int, payload_34_bytes: bytes) -> int:
        if len(payload_34_bytes) != 34:
            raise ValueError("write_all_params: payload must be 34 bytes")
        return self._xfer(addr, 0x46, payload_34_bytes)[3]

    # factory/reset
    def restore_factory(self, addr: int) -> int:
        return self._xfer(addr, 0x3F, b"")[3]

    def restart_motor(self, addr: int) -> int:
        return self._xfer(addr, 0x41, b"")[3]

    # power-on autorun
    def set_power_on_autorun(self, addr: int, enable: bool) -> int:
        """
        0xFF: Save or clear autorun (per vendor GUI):
          Save_Speed = 0xC8, Clear_Speed = 0xCA.
        """
        val = 0xC8 if enable else 0xCA
        return self._xfer(addr, 0xFF, bytes([val]))[3]

    # IO write (0x36)
    def write_io(self, addr: int, out1: Optional[int] = None, out2: Optional[int] = None, hold_others: bool = True) -> int:
        """
        0x36: Write OUT1/OUT2.
        We synthesize a single control byte compatible with common firmwares:
          bit3: write OUT2, bit1: OUT2 value
          bit2: write OUT1, bit0: OUT1 value
        If hold_others=True, unspecified outputs remain unchanged.
        """
        v = 0
        if out2 is not None:
            v |= (1 << 3)  # write OUT2
            if out2:
                v |= (1 << 1)
        if out1 is not None:
            v |= (1 << 2)  # write OUT1
            if out1:
                v |= (1 << 0)
        return self._xfer(addr, 0x36, bytes([v & 0xFF]))[3]

    # protection
    def release_protect(self, addr: int) -> int:
        return self._xfer(addr, 0x3D, b"")[3]
    
    # --- Convenience: firmware limits & quick state ---
    def enable_firmware_limits(self, addr: int, enable: bool = True) -> int:
        """
        Convenience wrapper for 0x9E (limit remap/enable).
        Lets the servo firmware enforce CW/CCW end-stops on IN1/IN2.
        """
        return self.set_limit_remap(addr, enable)

    def read_io_normalized(self, addr: int, inputs_active_low: bool = True) -> Dict[str, bool]:
        flags = self.read_io(addr)
        in1 = not bool(flags & IOFlags.IN1) if inputs_active_low else bool(flags & IOFlags.IN1)
        in2 = not bool(flags & IOFlags.IN2) if inputs_active_low else bool(flags & IOFlags.IN2)
        out1 = bool(flags & IOFlags.OUT1)
        out2 = bool(flags & IOFlags.OUT2)
        return {"IN1": in1, "IN2": in2, "OUT1": out1, "OUT2": out2}

    def read_limits(self, addr: int, inputs_active_low: bool = True) -> Dict[str, bool]:
        """
        Read limit switch states from 0x34 (IO flags).
        Returns True when the corresponding input is ACTIVE (pressed).
        Set inputs_active_low=False if your switches are active-high.
        """
        flags = self.read_io(addr)  # IOFlags bitfield
        raw_in1 = bool(flags & IOFlags.IN1)
        raw_in2 = bool(flags & IOFlags.IN2)

        if inputs_active_low:
            in1 = not raw_in1
            in2 = not raw_in2
        else:
            in1 = raw_in1
            in2 = raw_in2

        return {"in1": in1, "in2": in2}


    # ===== MOTION =====

    def query_status(self, addr: int) -> StatusF1:
        return StatusF1(self._xfer(addr, 0xF1, b"")[3])

    def enable(self, addr: int, enable: bool = True) -> int:
        return self._xfer(addr, 0xF3, bytes([1 if enable else 0]))[3]

    def emergency_stop(self, addr: int) -> int:
        return self._xfer(addr, 0xF7, b"")[3]

    # Speed mode (F6)
    def run_speed_mode(self, addr: int, dir_ccw: bool, speed_rpm: int, acc: int) -> int:
        b4, b5 = self._pack_speed_dir(dir_ccw, speed_rpm)
        return self._xfer(addr, 0xF6, bytes([b4, b5, acc & 0xFF]))[3]

    def stop_speed_mode(self, addr: int, acc: int = 0) -> int:
        return self._xfer(addr, 0xF6, bytes([0x00, 0x00, acc & 0xFF]))[3]

    # Position mode 1 — relative pulses (FD)
    def run_position_rel_pulses(self, addr: int, dir_ccw: bool, speed_rpm: int, acc: int, pulses: int) -> int:
        b4, b5 = self._pack_speed_dir(dir_ccw, speed_rpm)
        return self._xfer(addr, 0xFD, bytes([b4, b5, acc & 0xFF]) + _pack_u32(pulses))[3]

    def stop_position_rel_pulses(self, addr: int, acc: int = 0) -> int:
        return self._xfer(addr, 0xFD, bytes([0x00, 0x00, acc & 0xFF]) + _pack_u32(0))[3]

    # Position mode 2 — absolute pulses (FE)
    def run_position_abs_pulses(self, addr: int, speed_rpm: int, acc: int, abs_pulses: int) -> int:
        return self._xfer(addr, 0xFE, _pack_u16(speed_rpm) + bytes([acc & 0xFF]) + _pack_i32(abs_pulses))[3]

    def stop_position_abs_pulses(self, addr: int, acc: int = 0) -> int:
        return self._xfer(addr, 0xFE, _pack_u16(0) + bytes([acc & 0xFF]) + _pack_i32(0))[3]

    # Position mode 3/4 — axis ticks (F4/F5)
    def move_axis_relative(self, addr: int, speed_rpm: int, acc: int, rel_axis_ticks: int) -> int:
        return self._xfer(addr, 0xF4, _pack_u16(speed_rpm) + bytes([acc & 0xFF]) + _pack_i32(rel_axis_ticks))[3]

    def move_axis_absolute(self, addr: int, speed_rpm: int, acc: int, abs_axis_ticks: int) -> int:
        return self._xfer(addr, 0xF5, _pack_u16(speed_rpm) + bytes([acc & 0xFF]) + _pack_i32(abs_axis_ticks))[3]

    # Degree convenience
    def move_relative_degrees(self, addr: int, speed_rpm: int, acc: int, degrees: float) -> int:
        return self.move_axis_relative(addr, speed_rpm, acc, degrees_to_axis_ticks(degrees))

    def move_to_degrees(self, addr: int, speed_rpm: int, acc: int, target_deg: float) -> int:
        return self.move_axis_absolute(addr, speed_rpm, acc, degrees_to_axis_ticks(target_deg))

    def read_angle_degrees(self, addr: int) -> float:
        axis = self.read_encoder_addition(addr)
        return axis_ticks_to_degrees(axis)

    # lifecycle
    def close(self):
        try:
            self.ser.close()
        except Exception:
            pass
