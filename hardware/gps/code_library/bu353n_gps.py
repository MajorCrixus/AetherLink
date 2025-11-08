#!/usr/bin/env python3
"""
bu353n_gps.py — Library for GlobalSat BU-353N USB GPS Receiver
- USB GPS receiver (SiRF Star IV chipset)
- NMEA 0183 output via USB serial at 4800 baud (default)
- Simple NMEA reader compatible with GPSProvider interface

Usage:
    from bu353n_gps import BU353NGPS
    gps = BU353NGPS(port="/dev/gps", baud=4800)
    gps.start()
    print(gps.get_latest_fix())
    gps.stop()

Notes:
- This module outputs NMEA sentences only (GGA, RMC, GSA, GSV, etc.)
- Default baud rate is 4800
- For configuration changes, use SiRF binary protocol (not implemented here)
"""

import threading
import serial
import time
from typing import Optional, Dict, Any, Callable, List

# ---------------------------
# Constants & utilities
# ---------------------------

DEFAULT_PORT = "/dev/gps"
DEFAULT_BAUD = 4800
READ_TIMEOUT = 1.0

# NMEA sentences commonly output by BU-353N
NMEA_WANTED = ("GPGGA", "GPRMC", "GPGSA", "GPGSV", "GPGLL", "GPVTG")

def nmea_checksum_ok(line: str) -> bool:
    """
    Validate NMEA checksum. line should begin with '$' and contain '*CS'.
    """
    if not line.startswith("$") or "*" not in line:
        return False
    body, cs = line[1:].split("*", 1)
    calc = 0
    for ch in body:
        calc ^= ord(ch)
    try:
        got = int(cs[:2], 16)
    except ValueError:
        return False
    return got == calc

def nmea_dm_to_deg(dm: str, hemi: str) -> Optional[float]:
    """
    Convert NMEA degrees-minutes to decimal degrees.
    dm like "4838.59690" for lat, "00901.34995" for lon.
    """
    if not dm or "." not in dm:
        return None
    dot = dm.index(".")
    deg_len = 2 if dot <= 4 else 3
    try:
        deg = float(dm[:deg_len])
        minutes = float(dm[deg_len:])
    except ValueError:
        return None
    val = deg + minutes / 60.0
    if hemi in ("S", "W"):
        val = -val
    return val

# ---------------------------
# BU353NGPS class
# ---------------------------

class BU353NGPS:
    """
    High-level GPS interface for GlobalSat BU-353N USB GPS.
    - start()/stop() manage a background reader thread
    - subscribe(callback) to receive raw NMEA lines
    - get_latest_fix() returns the most recent parsed fix from NMEA RMC/GGA
    """

    def __init__(self,
                 port: str = DEFAULT_PORT,
                 baud: int = DEFAULT_BAUD,
                 timeout: float = READ_TIMEOUT):
        self.port = port
        self.baud = baud
        self.timeout = timeout
        self.ser: Optional[serial.Serial] = None
        self._th: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._subs: List[Callable[[bytes], None]] = []
        self._lock = threading.Lock()
        self._latest: Dict[str, Any] = {
            "time_utc": None,
            "lat": None,
            "lon": None,
            "alt_m": None,
            "fix": 0,
            "sats": 0,
            "hdop": None,
            "speed_mps": None,
            "course_deg": None,
            "source": "NMEA",
        }

    # ---- lifecycle ----

    def open(self):
        if self.ser and self.ser.is_open:
            return
        self.ser = serial.Serial(self.port, self.baud, timeout=self.timeout)
        # Flush any stale input
        self.ser.reset_input_buffer()

    def close(self):
        if self.ser:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None

    def start(self):
        """Start background reader."""
        self.open()
        self._stop.clear()
        self._th = threading.Thread(target=self._reader_loop, daemon=True)
        self._th.start()

    def stop(self):
        """Stop background reader and close port."""
        self._stop.set()
        if self._th and self._th.is_alive():
            self._th.join(timeout=2.0)
        self._th = None
        self.close()

    # ---- pub/sub ----

    def subscribe(self, cb: Callable[[bytes], None]):
        """Subscribe to raw incoming NMEA lines."""
        self._subs.append(cb)

    # ---- info ----

    def get_latest_fix(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._latest)

    # ---- reader loop ----

    def _reader_loop(self):
        """Read NMEA sentences line by line."""
        assert self.ser is not None
        ser = self.ser
        buf_line = bytearray()
        while not self._stop.is_set():
            try:
                # Check if serial port is still open
                if not ser.is_open:
                    print("GPS serial port closed, stopping reader loop")
                    break
                b = ser.read(1)
            except Exception as e:
                print(f"GPS serial read error: {e}")
                time.sleep(0.1)
                continue
            if not b:
                continue
            ch = b[0]
            if ch == 0x24:  # '$' -> NMEA line
                buf_line = bytearray(b)
                # read until newline
                while True:
                    try:
                        c = ser.read(1)
                        if not c:
                            break
                        buf_line += c
                        if c in (b'\n', b'\r'):
                            break
                    except Exception as e:
                        print(f"GPS serial read error in NMEA parsing: {e}")
                        break
                line = buf_line.decode("ascii", errors="ignore").strip()
                self._notify(line.encode("ascii", errors="ignore"))
                self._handle_nmea(line)

    def _notify(self, raw: bytes):
        for cb in self._subs:
            try:
                cb(raw)
            except Exception:
                pass

    # ---- parsers ----

    def _handle_nmea(self, line: str):
        if not line.startswith("$") or "*" not in line:
            return
        if not nmea_checksum_ok(line):
            return
        tag = line[1:6]
        fields = line.split(",")

        with self._lock:
            if tag in ("GPRMC", "GNRMC"):
                # $GPRMC,hhmmss.sss,A,lat,NS,lon,EW,sog,cog,ddmmyy,mag,var,mode*CS
                status = fields[2] if len(fields) > 2 else "V"
                if status == "A":
                    lat = nmea_dm_to_deg(fields[3], fields[4]) if len(fields) > 5 else None
                    lon = nmea_dm_to_deg(fields[5], fields[6]) if len(fields) > 7 else None
                    spd = None
                    try:
                        spd = float(fields[7]) * 0.514444 if fields[7] else None  # knots->m/s
                    except ValueError:
                        pass
                    crs = None
                    try:
                        crs = float(fields[8]) if fields[8] else None
                    except ValueError:
                        pass
                    self._latest.update({
                        "lat": lat, "lon": lon,
                        "speed_mps": spd, "course_deg": crs,
                        "fix": max(self._latest.get("fix", 0), 1),
                        "source": "NMEA"
                    })
            elif tag in ("GPGGA", "GNGGA"):
                # $GPGGA,time,lat,NS,lon,EW,fix,sats,hdop,alt,M,geoid,M,...
                try:
                    fix = int(fields[6]) if len(fields) > 6 and fields[6] else 0
                except ValueError:
                    fix = 0
                sats = 0
                try:
                    sats = int(fields[7]) if len(fields) > 7 and fields[7] else 0
                except ValueError:
                    pass
                hdop = None
                try:
                    hdop = float(fields[8]) if len(fields) > 8 and fields[8] else None
                except ValueError:
                    pass
                alt = None
                try:
                    alt = float(fields[9]) if len(fields) > 9 and fields[9] else None
                except ValueError:
                    pass
                # Also parse lat/lon from GGA if available
                lat = nmea_dm_to_deg(fields[2], fields[3]) if len(fields) > 4 and fields[2] else None
                lon = nmea_dm_to_deg(fields[4], fields[5]) if len(fields) > 6 and fields[4] else None

                self._latest.update({
                    "fix": fix,
                    "sats": sats,
                    "hdop": hdop,
                    "alt_m": alt,
                    "source": "NMEA"
                })
                # Update lat/lon if we got them
                if lat is not None:
                    self._latest["lat"] = lat
                if lon is not None:
                    self._latest["lon"] = lon

    # ---- Auto-detection (optional) ----

    def autobaud(self,
                 ports: Optional[List[str]] = None,
                 bauds: Optional[List[int]] = None,
                 seconds_per_try: float = 2.0) -> Optional[tuple[str, int, str]]:
        """
        Try a set of (port,baud) combos to detect NMEA.
        Returns (port, baud, mode) where mode is "NMEA" or None if not found.
        BU-353N typically runs at 4800 baud.
        """
        ports = ports or [self.port]
        bauds = bauds or [4800, 9600, 57600, 115200]
        for p in ports:
            for b in bauds:
                try:
                    with serial.Serial(p, b, timeout=0.2) as s:
                        t0 = time.time()
                        got_nmea = False
                        while time.time() - t0 < seconds_per_try:
                            chunk = s.read(256)
                            if not chunk:
                                continue
                            if b'$G' in chunk or b'$GP' in chunk:
                                got_nmea = True
                                break
                        if got_nmea:
                            # lock in
                            self.port, self.baud = p, b
                            return (p, b, "NMEA")
                except Exception:
                    continue
        return None
