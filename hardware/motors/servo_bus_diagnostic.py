#!/usr/bin/env python3
"""
MKS SERVO42D/57D RS485 Bus Diagnostic (FW v1.0.x)
- Protocols: MODBUS-RTU (default) OR MKS FA/FB UART frames (use --proto fa)
- Checks availability, CRC/checksum integrity, status/health, I/O, speed, Wrong Protect flag
- Default addresses: 1=Azimuth, 2=Elevation, 3=Cross-Link (override via --addrs)
"""

import os, glob, time, struct, binascii, json, sys
from typing import List, Tuple, Optional, Dict, Any, Union
import serial
import typer

try:
    from serial.tools import list_ports
except Exception:
    list_ports = None

# ---------- util / config ----------

def _to_int(v: Optional[Union[str,int]]) -> Optional[int]:
    if v is None: return None
    if isinstance(v, int): return v
    try: return int(str(v).strip(), 0)
    except Exception: return None

def load_config(path: Optional[str]) -> dict:
    if not path: return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[warn] config file not found: {path} — continuing without it", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"[warn] failed to read config {path}: {e} — continuing without it", file=sys.stderr)
        return {}

def find_default_config() -> Optional[str]:
    here = os.path.dirname(__file__)
    candidates = [
        os.path.abspath(os.path.join(here, "../../tools/config/ports.json")),
        "/home/major/Desktop/aetherlink/back_end/tools/config/ports.json",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def select_serial_port(
    preferred: Optional[str],
    match_vid: Optional[int] = None,
    match_pid: Optional[int] = None,
    match_serial: Optional[str] = None,
    match_product: Optional[str] = None,
    match_manufacturer: Optional[str] = None,
    match_location: Optional[str] = None,
) -> str:
    if preferred and preferred.lower() not in ("auto", "detect"):
        p = os.path.realpath(preferred)
        if os.path.exists(p):
            return p
    if list_ports:
        candidates = []
        for info in list_ports.comports():
            dev = info.device
            vid = getattr(info, "vid", None)
            pid = getattr(info, "pid", None)
            ser = getattr(info, "serial_number", None)
            prod = getattr(info, "product", None)
            manu = getattr(info, "manufacturer", None)
            loc  = getattr(info, "location", None) or getattr(info, "usb_location", None)

            def _ok(sub, val): return (sub is None) or (val and sub.lower() in str(val).lower())
            def _eq(w, g): return (w is None) or (g == w)

            if _eq(match_vid, vid) and _eq(match_pid, pid) and \
               _ok(match_serial, ser) and _ok(match_product, prod) and \
               _ok(match_manufacturer, manu) and _ok(match_location, loc):
                candidates.append(dev)
        if candidates:
            byid = sorted(glob.glob("/dev/serial/by-id/*"))
            for d in candidates:
                for path in byid:
                    if os.path.realpath(path) == os.path.realpath(d):
                        return path
            return candidates[0]
    by_id = sorted(glob.glob("/dev/serial/by-id/*"))
    if by_id: return by_id[0]
    for pat in ("/dev/rs485", "/dev/ttyUSB*"):
        lst = sorted(glob.glob(pat))
        if lst: return lst[0]
    raise FileNotFoundError("No serial ports found. Is the USB-RS485 adapter connected?")

def open_serial(port: str, baud: int, timeout: float,
                match_vid: Optional[int]=None,
                match_pid: Optional[int]=None,
                match_serial: Optional[str]=None,
                match_product: Optional[str]=None,
                match_manufacturer: Optional[str]=None,
                match_location: Optional[str]=None) -> serial.Serial:
    p = select_serial_port(port, match_vid, match_pid, match_serial, match_product, match_manufacturer, match_location)
    if port.lower() in ("auto","detect"):
        print(f"[info] selected serial port: {p}")
    return serial.Serial(
        port=p, baudrate=baud,
        bytesize=serial.EIGHTBITS, parity=serial.PARITY_NONE, stopbits=serial.STOPBITS_ONE,
        timeout=timeout, write_timeout=timeout,
    )

# ---------- MODBUS-RTU helpers ----------

def crc16_modbus(data: bytes) -> int:
    crc = 0xFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if (crc & 1) else (crc >> 1)
    return crc & 0xFFFF

def _le_crc_bytes(crc: int) -> bytes:
    return struct.pack("<H", crc)

def hexstr(b: Optional[bytes]) -> Optional[str]:
    return None if b is None else " ".join(f"{x:02X}" for x in b)

class ModbusRTU:
    def __init__(self, ser: serial.Serial, inter_frame_s: float = 0.004):
        self.ser = ser
        self.ifg = inter_frame_s

    def _write(self, payload: bytes) -> None:
        self.ser.reset_input_buffer()
        time.sleep(self.ifg)
        self.ser.write(payload); self.ser.flush()

    def _read_exact(self, n: int, timeout_s: float) -> bytes:
        end = time.time() + timeout_s
        out = bytearray()
        while len(out) < n and time.time() < end:
            chunk = self.ser.read(n - len(out))
            if chunk: out.extend(chunk)
            else: time.sleep(0.0005)
        return bytes(out)

    def read_input_registers(self, addr: int, start_reg: int, qty: int, timeout_s: float = 0.12) -> Tuple[bytes, bytes, bytes]:
        req_pdu = struct.pack(">B B H H", addr, 0x04, start_reg, qty)
        req = req_pdu + _le_crc_bytes(crc16_modbus(req_pdu))
        self._write(req)
        hdr = self._read_exact(3, timeout_s)
        if len(hdr) < 3: raise TimeoutError("No response (header)")
        r_addr, r_func, byte_count = hdr[0], hdr[1], hdr[2]
        if r_addr != addr: raise IOError(f"Addr mismatch (got {r_addr}, want {addr})")
        if r_func == (0x80 | 0x04):
            ex = self._read_exact(3, timeout_s)
            raise IOError(f"MODBUS exception func=0x84 code=0x{ex[0]:02X} resp={hexstr(hdr+ex)}")
        if r_func != 0x04:
            rest = self._read_exact(5, timeout_s); raise IOError(f"Function mismatch (0x{r_func:02X}) resp={hexstr(hdr+rest)}")
        data = self._read_exact(byte_count, timeout_s)
        crc_bytes = self._read_exact(2, timeout_s)
        resp = hdr + data + crc_bytes
        if len(data) != byte_count or len(crc_bytes) != 2: raise TimeoutError(f"Incomplete response: {hexstr(resp)}")
        calc = crc16_modbus(resp[:-2]); got = struct.unpack("<H", crc_bytes)[0]
        if calc != got: raise IOError(f"CRC mismatch resp_crc=0x{got:04X} calc=0x{calc:04X} resp={hexstr(resp)}")
        return req, resp, data

    def write_single_register(self, addr: int, reg: int, value: int, timeout_s: float = 0.12) -> Tuple[bytes, bytes]:
        req_pdu = struct.pack(">B B H H", addr, 0x06, reg, value)
        req = req_pdu + _le_crc_bytes(crc16_modbus(req_pdu))
        self._write(req)
        resp = self._read_exact(len(req), timeout_s)
        if len(resp) != len(req): raise TimeoutError(f"Incomplete write echo: {hexstr(resp)}")
        calc = crc16_modbus(resp[:-2]); got = struct.unpack("<H", resp[-2:])[0]
        if calc != got: raise IOError(f"CRC mismatch on write echo resp_crc=0x{got:04X} calc=0x{calc:04X} resp={hexstr(resp)}")
        if resp[:-2] != req[:-2]: raise IOError(f"Write echo mismatch req={hexstr(req)} resp={hexstr(resp)}")
        return req, resp

# ---------- FA/FB UART helpers (SUM8) ----------

# Data lengths: enc(0x30)=6, speed(0x32)=2, io(0x34)=2, protect_rd(0x3E)=1, status(0xF1)=1, protect_clr(0x3D)=1
FA_DATA_LEN = {0x30:6, 0x32:2, 0x34:1, 0x3E:1, 0xF1:1, 0x3D:1}

def sum8(buf: bytes) -> int:
    """MKS FA/FB checksum is the low byte of the sum of all bytes."""
    return sum(buf) & 0xFF

class FASerial:
    def __init__(self, ser: serial.Serial, inter_frame_s: float = 0.004):
        self.ser = ser
        self.ifg = inter_frame_s

    def _write(self, payload: bytes) -> None:
        self.ser.reset_input_buffer()
        time.sleep(self.ifg)
        self.ser.write(payload)
        self.ser.flush()

    def _read_exact(self, n: int, timeout_s: float) -> bytes:
        end = time.time() + timeout_s
        out = bytearray()
        while len(out) < n and time.time() < end:
            chunk = self.ser.read(n - len(out))
            if chunk:
                out.extend(chunk)
            else:
                time.sleep(0.0005)
        return bytes(out)

    def _build(self, addr: int, cmd: int, payload: bytes=b"") -> bytes:
        core = bytes([0xFA, addr & 0xFF, cmd & 0xFF]) + payload
        chk = sum8(core)
        return core + bytes([chk])

    def _expect_len(self, cmd: int) -> int:
        n = FA_DATA_LEN.get(cmd)
        if n is None:
            raise ValueError(f"Unknown FA cmd length for 0x{cmd:02X}")
        return 3 + n + 1  # FB,addr,cmd + data + chk

    def txrx(self, addr: int, cmd: int, payload: bytes=b"", timeout_s: float=0.12):
        req = self._build(addr, cmd, payload)
        self._write(req)

        exp = self._expect_len(cmd)
        resp = self._read_exact(exp, timeout_s)
        if len(resp) != exp:
            raise TimeoutError(f"FA resp len {len(resp)} != expected {exp}: {hexstr(resp)}")
        if resp[0] != 0xFB or resp[1] != (addr & 0xFF) or resp[2] != (cmd & 0xFF):
            raise IOError(f"FA header mismatch: {hexstr(resp[:3])}")
        # SUM8 check per manual: last byte equals low byte of sum of all previous bytes
        if (sum(resp[:-1]) & 0xFF) != resp[-1]:
            raise IOError(f"FA checksum bad resp={hexstr(resp)}")
        return req, resp, resp[3:-1]

# ---------- device map (shared parsing) ----------

REG_ENCODER_CARRY = 0x0030
REG_SPEED         = 0x0032
REG_IOFLAGS       = 0x0034
REG_PROTECT_RD    = 0x003E
REG_PROTECT_CLR   = 0x003D
REG_STATUS        = 0x00F1

STATUS_MAP = {
    0: "read_fail", 1: "stopped", 2: "speeding_up", 3: "slowing_down",
    4: "full_speed", 5: "homing", 6: "calibrating",
}

def parse_u8_or_u16_be(d: bytes) -> int:
    """Accepts 1-byte or 2-byte big-endian values."""
    if len(d) == 1:
        return d[0]
    return struct.unpack(">H", d)[0]

def parse_u16_be(data: bytes) -> int:
    return struct.unpack(">H", data)[0]

def parse_s16_be(data: bytes) -> int:
    return struct.unpack(">h", data)[0]

def parse_encoder_carry(d: bytes) -> Dict[str, Any]:
    return {
        "raw_hex": binascii.hexlify(d).decode(),
        "carry_guess": int.from_bytes(d[0:4], "big", signed=False),
        "value_guess": int.from_bytes(d[4:6], "big", signed=False),
    }

def parse_ioflags(u16val: int) -> Dict[str, bool]:
    b = u16val & 0xFF
    return {"IN1": bool(b & 0x01), "IN2": bool(b & 0x02), "OUT1": bool(b & 0x04), "OUT2": bool(b & 0x08)}

def safe(fn, retries=2, delay=0.02):
    last_err = None
    for _ in range(retries+1):
        try:
            return fn(), None
        except Exception as e:
            last_err = str(e); time.sleep(delay)
    return None, last_err

# ---------- common actions per protocol ----------

def _scan_modbus(mb: ModbusRTU, start: int, end: int, tries: int):
    for addr in range(start, end+1):
        triple, err = safe(lambda: mb.read_input_registers(addr, REG_STATUS, 1), retries=tries)
        ok = err is None
        status_val = None
        if ok:
            _, _, data = triple
            status_val = parse_u16_be(data) & 0xFF
        print(f"[{addr:02d}] {'OK' if ok else 'NO-RESP'}"
              + (f" status={STATUS_MAP.get(status_val, f'unknown({status_val})')}" if status_val is not None else "")
              + ("" if ok else f"  err={err}"))

def _scan_fa(fa: FASerial, start: int, end: int, tries: int):
    for addr in range(start, end+1):
        triple, err = safe(lambda: fa.txrx(addr, REG_STATUS & 0xFF), retries=tries)  # cmd 0xF1
        ok = err is None
        status_val = None
        if ok:
            _, _, data = triple
            status_val = data[0]
        print(f"[{addr:02d}] {'OK' if ok else 'NO-RESP'}"
              + (f" status={STATUS_MAP.get(status_val, f'unknown({status_val})')}" if status_val is not None else "")
              + ("" if ok else f"  err={err}"))

def _check_modbus(mb: ModbusRTU, addrs: List[int], tries: int, verbose: bool) -> Dict[int, Any]:
    summary: Dict[int, Any] = {}
    for addr in addrs:
        entry: Dict[str, Any] = {"addr": addr}
        # status
        triple, err = safe(lambda: mb.read_input_registers(addr, REG_STATUS, 1), tries)
        entry["status_ok"] = err is None; entry["status_raw"] = hexstr(triple[1]) if triple else None
        if triple:
            val = parse_u16_be(triple[2]) & 0xFF; entry["status"] = STATUS_MAP.get(val, f"unknown({val})")
        else: entry["status_error"] = err

        # wrong protect
        triple, err = safe(lambda: mb.read_input_registers(addr, REG_PROTECT_RD, 1), tries)
        entry["protect_ok"] = err is None; entry["protect_raw"] = hexstr(triple[1]) if triple else None
        entry["wrong_protect"] = bool(parse_u16_be(triple[2]) & 0xFF) if triple else None
        if err: entry["protect_error"] = err

        # io
        triple, err = safe(lambda: mb.read_input_registers(addr, REG_IOFLAGS, 1), tries)
        entry["io_ok"] = err is None; entry["io_raw"] = hexstr(triple[1]) if triple else None
        entry["io"] = parse_ioflags(parse_u8_or_u16_be(triple[2])) if triple else None
        if err: entry["io_error"] = err

        # speed
        triple, err = safe(lambda: mb.read_input_registers(addr, REG_SPEED, 1), tries)
        entry["speed_ok"] = err is None; entry["speed_raw"] = hexstr(triple[1]) if triple else None
        entry["speed_rpm"] = parse_s16_be(triple[2]) if triple else None
        if err: entry["speed_error"] = err

        # encoder
        triple, err = safe(lambda: mb.read_input_registers(addr, REG_ENCODER_CARRY, 3), tries)
        entry["enc_ok"] = err is None; entry["enc_raw"] = hexstr(triple[1]) if triple else None
        entry["encoder"] = parse_encoder_carry(triple[2]) if triple else None
        if err: entry["enc_error"] = err

        summary[addr] = entry
        line = (f"[{addr:02d}] COMM={'OK' if entry['status_ok'] else 'FAIL'}  "
                f"STAT={entry.get('status','?'):>12}  "
                f"WRONG_PROTECT={'YES' if entry.get('wrong_protect') else 'NO ' if entry.get('wrong_protect') is False else '??'}  "
                f"SPEED={entry.get('speed_rpm','?'):>6} rpm")
        print(line)
        if verbose:
            print(f"  IO: {entry.get('io')}")
            for k in ("status_raw","protect_raw","io_raw","speed_raw","enc_raw"):
                if entry.get(k): print(f"  {k}: {entry[k]}")
        time.sleep(0.01)
    return summary

def _check_fa(fa: FASerial, addrs: List[int], tries: int, verbose: bool) -> Dict[int, Any]:
    summary: Dict[int, Any] = {}
    for addr in addrs:
        entry: Dict[str, Any] = {"addr": addr}

        def rx(cmd, payload=b""):
            return safe(lambda: fa.txrx(addr, cmd, payload), tries)

        # status
        triple, err = rx(REG_STATUS & 0xFF)
        entry["status_ok"] = err is None
        entry["status_raw"] = hexstr(triple[1]) if triple else None
        if triple:
            val = triple[2][0]
            entry["status"] = STATUS_MAP.get(val, f"unknown({val})")
        else:
            entry["status_error"] = err

        # wrong protect
        triple, err = rx(REG_PROTECT_RD & 0xFF)
        entry["protect_ok"] = err is None
        entry["protect_raw"] = hexstr(triple[1]) if triple else None
        entry["wrong_protect"] = (triple and bool(triple[2][0])) or (False if triple and triple[2] == b"\x00" else None)
        if err: entry["protect_error"] = err

        # io
        triple, err = rx(REG_IOFLAGS & 0xFF)
        entry["io_ok"] = err is None; entry["io_raw"] = hexstr(triple[1]) if triple else None
        entry["io"] = parse_ioflags(parse_u8_or_u16_be(triple[2])) if triple else None
        if err: entry["io_error"] = err

        # speed
        triple, err = rx(REG_SPEED & 0xFF)
        entry["speed_ok"] = err is None; entry["speed_raw"] = hexstr(triple[1]) if triple else None
        entry["speed_rpm"] = parse_s16_be(triple[2]) if triple else None
        if err: entry["speed_error"] = err

        # encoder
        triple, err = rx(REG_ENCODER_CARRY & 0xFF)
        entry["enc_ok"] = err is None; entry["enc_raw"] = hexstr(triple[1]) if triple else None
        entry["encoder"] = parse_encoder_carry(triple[2]) if triple else None
        if err: entry["enc_error"] = err

        summary[addr] = entry
        line = (f"[{addr:02d}] COMM={'OK' if entry['status_ok'] else 'FAIL'}  "
                f"STAT={entry.get('status','?'):>12}  "
                f"WRONG_PROTECT={'YES' if entry.get('wrong_protect') else 'NO ' if entry.get('wrong_protect') is False else '??'}  "
                f"SPEED={entry.get('speed_rpm','?'):>6} rpm")
        print(line)
        if verbose:
            print(f"  IO: {entry.get('io')}")
            for k in ("status_raw","protect_raw","io_raw","speed_raw","enc_raw"):
                if entry.get(k): print(f"  {k}: {entry[k]}")
        time.sleep(0.01)
    return summary

# ---------- Typer commands ----------

def _resolve_matchers(config: Optional[str],
                      match_vid: Optional[str], match_pid: Optional[str], match_serial: Optional[str],
                      match_product: Optional[str], match_manufacturer: Optional[str], match_location: Optional[str]):
    cfg = load_config(config or find_default_config())
    rs = cfg.get("rs485", {}) or {}
    return (
        _to_int(match_vid) or _to_int(rs.get("vid")),
        _to_int(match_pid) or _to_int(rs.get("pid")),
        match_serial or rs.get("serial_number"),
        match_product or rs.get("product"),
        match_manufacturer or rs.get("manufacturer"),
        match_location or rs.get("location"),
    )

app = typer.Typer(add_completion=False, help="""
MKS RS485 Bus Diagnostic
Examples:
  python servo_bus_diagnostic.py scan   --proto fa --port auto --baud 38400 --start 1 --end 3
  python servo_bus_diagnostic.py check  --proto fa --port auto --baud 38400 --addrs 1,2,3 --json
  python servo_bus_diagnostic.py release-protect 1 2 3 --proto fa --port auto --baud 38400
""")

def _normalize_addrs(addrs_flags: List[str]|None) -> List[int]:
    if not addrs_flags: return [1,2,3]
    out: List[int] = []
    for token in addrs_flags:
        for piece in str(token).replace(",", " ").split():
            out.append(int(piece))
    return out

@app.command()
def scan(
    proto: str = typer.Option("modbus", help="Protocol: 'modbus' or 'fa'"),
    port: str = typer.Option("auto", help="Serial device path or 'auto'"),
    baud: int = typer.Option(38400, help="Baudrate"),
    start: int = typer.Option(1), end: int = typer.Option(16),
    tries: int = typer.Option(2),
    json_out: bool = typer.Option(False, "--json"),
    config: Optional[str] = typer.Option(None, "--config", help="Path to config.json"),
    match_vid: Optional[str] = typer.Option(None), match_pid: Optional[str] = typer.Option(None),
    match_serial: Optional[str] = typer.Option(None), match_product: Optional[str] = typer.Option(None),
    match_manufacturer: Optional[str] = typer.Option(None), match_location: Optional[str] = typer.Option(None),
):
    mv, mp, ms, mprod, mmanu, mloc = _resolve_matchers(config, match_vid, match_pid, match_serial, match_product, match_manufacturer, match_location)
    ser = open_serial(port, baud, 0.12, mv, mp, ms, mprod, mmanu, mloc)
    if proto.lower() == "modbus":
        mb = ModbusRTU(ser)
        _scan_modbus(mb, start, end, tries)
    else:
        fa = FASerial(ser)
        _scan_fa(fa, start, end, tries)
    ser.close()

@app.command("check")
def check_bus(
    proto: str = typer.Option("modbus", help="Protocol: 'modbus' or 'fa'"),
    addrs: List[str] = typer.Option(None, "--addrs", "-a", help="Repeat or use commas: --addrs 1 --addrs 2 or --addrs 1,2,3"),
    port: str = typer.Option("auto"), baud: int = typer.Option(38400),
    tries: int = typer.Option(2), json_out: bool = typer.Option(False, "--json"),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
    config: Optional[str] = typer.Option(None, "--config"),
    match_vid: Optional[str] = typer.Option(None), match_pid: Optional[str] = typer.Option(None),
    match_serial: Optional[str] = typer.Option(None), match_product: Optional[str] = typer.Option(None),
    match_manufacturer: Optional[str] = typer.Option(None), match_location: Optional[str] = typer.Option(None),
):
    addrs_list = _normalize_addrs(addrs)
    mv, mp, ms, mprod, mmanu, mloc = _resolve_matchers(config, match_vid, match_pid, match_serial, match_product, match_manufacturer, match_location)
    ser = open_serial(port, baud, 0.12, mv, mp, ms, mprod, mmanu, mloc)
    if proto.lower() == "modbus":
        mb = ModbusRTU(ser)
        summary = _check_modbus(mb, addrs_list, tries, verbose)
    else:
        fa = FASerial(ser)
        summary = _check_fa(fa, addrs_list, tries, verbose)
    ser.close()
    if json_out:
        print(json.dumps(summary, indent=2))

@app.command("release-protect")
def release_protect(
    proto: str = typer.Option("modbus", help="Protocol: 'modbus' or 'fa'"),
    addrs: List[int] = typer.Argument(..., help="Servo addresses to release"),
    port: str = typer.Option("auto"), baud: int = typer.Option(38400),
    tries: int = typer.Option(2),
    config: Optional[str] = typer.Option(None, "--config"),
    match_vid: Optional[str] = typer.Option(None), match_pid: Optional[str] = typer.Option(None),
    match_serial: Optional[str] = typer.Option(None), match_product: Optional[str] = typer.Option(None),
    match_manufacturer: Optional[str] = typer.Option(None), match_location: Optional[str] = typer.Option(None),
):
    mv, mp, ms, mprod, mmanu, mloc = _resolve_matchers(config, match_vid, match_pid, match_serial, match_product, match_manufacturer, match_location)
    ser = open_serial(port, baud, 0.12, mv, mp, ms, mprod, mmanu, mloc)
    if proto.lower() == "modbus":
        mb = ModbusRTU(ser)
        for addr in addrs:
            triple, err = safe(lambda: mb.write_single_register(addr, REG_PROTECT_CLR, 0x0001), tries)
            print(f"[{addr:02d}] release {'OK' if err is None else 'FAIL'}" + ("" if err is None else f"  err={err}"))
            time.sleep(0.02)
            triple2, err2 = safe(lambda: mb.read_input_registers(addr, REG_PROTECT_RD, 1), tries)
            cleared = (err2 is None and triple2 and (parse_u16_be(triple2[2]) & 0xFF) == 0)
            print(f"       verify wrong_protect={'NO' if cleared else 'STILL_SET/UNKNOWN'}")
    else:
        fa = FASerial(ser)
        for addr in addrs:
            triple, err = safe(lambda: fa.txrx(addr, REG_PROTECT_CLR & 0xFF, b"\x01"), tries)
            print(f"[{addr:02d}] release {'OK' if err is None else 'FAIL'}" + ("" if err is None else f"  err={err}"))
            time.sleep(0.02)
            triple2, err2 = safe(lambda: fa.txrx(addr, REG_PROTECT_RD & 0xFF), tries)
            cleared = (err2 is None and triple2 and triple2[2] == b"\x00")
            print(f"       verify wrong_protect={'NO' if cleared else 'STILL_SET/UNKNOWN'}")
    ser.close()

if __name__ == "__main__":
    try:
        app()
    except KeyboardInterrupt:
        pass
