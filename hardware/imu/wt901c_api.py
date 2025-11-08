#!/usr/bin/env python3
"""
FastAPI service for WT901C-TTL (WitMotion) IMU — with Orientation & Declination

Data Endpoints
--------------
GET  /health                               -> Extended health check with sensor availability
GET  /snapshot?types=ang,gyro,acc,mag,...  -> Latest data snapshot (all types)
GET  /last/{name}                          -> Latest single packet (ang, gyro, acc, mag, baro, quat, time, gps, gps2, dport, orientation)
GET  /sse?types=ang,gyro,orientation       -> Server-Sent Events (JSON lines; now supports 'orientation')
WS   /ws                                   -> WebSocket streaming JSON packets as they arrive
GET  /debug/stats                          -> Packet rates and ages

Orientation (NEW)
-----------------
GET  /orientation                          -> Latest computed orientation (heading_mag/true, cross_level, elevation, declination info)

Orientation Configuration (NEW)
-------------------------------
POST /orientation/declination/{deg}        -> Manually set magnetic declination (deg, east positive)
POST /orientation/offset/{deg}             -> Set heading offset so "this pose = 0°"
POST /orientation/declination/gps          -> Update declination from GPS fix (JSON: lat, lon, alt_m, iso8601 time)

Declination via GPS (Notes)
---------------------------
- The library accepts a declination provider function (WMM/IGRF) but **does not**
  bundle a model (keeps your project light). If you have one, register it once
  at startup via `imu.set_declination_provider(fn)`. Then call
  `/orientation/declination/gps` when you receive a GPS fix — or wire it
  automatically from your GPS path.
- If you do not set a provider, `/orientation/declination/gps` is a **no-op**
  and the API will keep using whatever manual declination you set.

Run
---
IMU_PORT=/dev/imu IMU_BAUD=9600 python -m back_end.hardware.imu.wt901c_api --host 0.0.0.0 --port 8080

Docs
----
Visit http://localhost:8080/docs for interactive Swagger UI.

Requirements
------------
pip install fastapi uvicorn
"""

from __future__ import annotations

import os
import json
import asyncio
import argparse
import contextlib
import time
from contextlib import asynccontextmanager
from collections import defaultdict
from pathlib import Path
from dataclasses import asdict, is_dataclass
from typing import Dict, Optional, Set, Tuple, Iterable, List, cast, Any
from datetime import datetime

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response, RedirectResponse
from fastapi.openapi.docs import get_swagger_ui_html

# Import the upgraded driver (has Orientation + declination hooks)
from .wt901c import (
    WT901C, PID, Packet, Orientation,
    Accel, Gyro, Angles, Mag, TimePacket, Quaternion, PressureAlt, GPSData, GPSAccuracy, PortStatus,
    AXIS_DIR_HORIZONTAL, AXIS_DIR_VERTICAL
)

# ---------- Helpers ----------

PID_NAME = {
    PID.TIME: "time",
    PID.ACC:  "acc",
    PID.GYRO: "gyro",
    PID.ANG:  "ang",
    PID.MAG:  "mag",
    PID.BARO: "baro",
    PID.GPS:  "gps",
    PID.GPS2: "gps2",
    PID.QUAT: "quat",
    PID.DPORT:"dport",
}
# include 'orientation' as a pseudo-stream type
SELECTABLE = ("time", "acc", "gyro", "ang", "mag", "baro", "quat", "gps", "gps2", "dport", "orientation")

def packet_to_dict(pid: PID, pkt: Optional[Packet]) -> Optional[Dict]:
    if pkt is None:
        return None
    d = asdict(pkt) if is_dataclass(pkt) else {"raw": repr(pkt)}
    name = PID_NAME.get(pid, f"0x{int(pid):02X}")
    # Hide flaky ANG temp if present
    if name == "ang" and "temp_c" in d:
        d.pop("temp_c", None)
    d["_pid"] = name
    return d

# ---------- Hub (bridges driver thread -> asyncio) ----------

class IMUHub:
    def __init__(self, port: str, baud: int = 115200, timeout: float = 0.2):
        self.port = port
        self.baud = baud
        self.timeout = timeout

        self.imu = WT901C(port=port, baud=baud, timeout=timeout)
        self.loop: Optional[asyncio.AbstractEventLoop] = None

        self.latest: Dict[str, Dict[str, Any]] = {}
        self.sse_subs: Set[asyncio.Queue] = set()
        self.ws_subs: Set[WebSocket] = set()
        self._started = False

        # Stats
        self.counts = defaultdict(int)
        self.first_mono = time.monotonic()
        self.last_mono: Dict[str, float] = {}

        # IMU → asyncio callback
        def cb(pid: PID, pkt: Optional[Packet]):
            payload = packet_to_dict(pid, pkt)
            if payload is None:
                return
            name = PID_NAME.get(pid, f"0x{int(pid):02X}")
            msg = {"type": name, "data": payload, "ts": time.monotonic()}
            if self.loop:
                self.loop.call_soon_threadsafe(self._publish, name, msg)

            # Each time new sensor data arrives, try to compute orientation
            if self.loop and name in ("acc", "mag"):  # recompute when inputs change
                self.loop.call_soon_threadsafe(self._publish_orientation)

        self.imu.on_packet(cb)

    # Orientation recompute + publish as a pseudo-packet
    def _publish_orientation(self):
        o = self.imu.orientation_json()
        if not o:
            return
        name = "orientation"
        msg = {"type": name, "data": o, "ts": time.monotonic()}
        self._publish(name, msg)

    def set_output_content_mask(self, mask: int) -> None:
        # Common mapping (but varies by firmware):
        # bit0=ACC(0x51), bit1=GYRO(0x52), bit2=ANG(0x53), bit3=MAG(0x54),
        # bit4=BARO(0x56), bit5=QUAT(0x59)
        self.imu.write_register(0x02, mask & 0xFF)

    # ---- lifecycle ----
    def attach_loop(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop

    def start(self):
        if not self._started:
            self.imu.start()
            self._started = True

    def stop(self):
        if self._started:
            self.imu.stop()
            self._started = False

    def close(self):
        self.imu.close()

    # ---- publish/subscribe ----
    def _publish(self, name: str, msg: Dict):
        self.latest[name] = msg
        self.counts[name] += 1
        self.last_mono[name] = time.monotonic()

        # SSE
        dead: List[asyncio.Queue] = []
        for q in self.sse_subs:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass
            except Exception:
                dead.append(q)
        for q in dead:
            self.sse_subs.discard(q)

        # WS
        async def _send(ws: WebSocket, payload: Dict):
            with contextlib.suppress(Exception):
                await ws.send_json(payload)
        for ws in list(self.ws_subs):
            try:
                asyncio.create_task(_send(ws, msg))
            except Exception:
                self.ws_subs.discard(ws)

    # ---- snapshots ----
    def snapshot(self, types: Iterable[str]) -> Dict[str, Dict]:
        out: Dict[str, Dict] = {}
        for t in types:
            t = t.lower()
            if t in self.latest:
                out[t] = self.latest[t]
        return {"ts": {"mono": asyncio.get_running_loop().time()}, **out}

    async def sse_stream(self, types: Iterable[str]):
        """Async generator for SSE."""
        wanted = set(t.lower() for t in types) if types else set(SELECTABLE)
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.sse_subs.add(q)
        try:
            # Initial snapshot
            snap = self.snapshot(wanted)
            yield f"data: {json.dumps(snap)}\n\n"
            # Stream updates
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=5.0)
                    if msg["type"] in wanted:
                        yield f"data: {json.dumps(msg)}\n\n"
                except asyncio.TimeoutError:
                    # heartbeat
                    yield "event: ping\ndata: {}\n\n"
        finally:
            self.sse_subs.discard(q)

# ---------- App factory ----------

def create_app(port: str, baud: int) -> FastAPI:
    try:
        hub = IMUHub(port=port, baud=baud)
    except Exception as e:
        app = FastAPI(title="WT901C-TTL 9-axis IMU API (error)")
        @app.get("/health")
        def health(): return {"ok": False, "error": f"serial open failed: {e}"}
        return app

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        hub.attach_loop(asyncio.get_running_loop())
        hub.start()
        try:
            yield
        finally:
            hub.stop()
            hub.close()

    app = FastAPI(
        title="WT901C-TTL 9-axis IMU API",
        version="1.1.0",
        lifespan=lifespan,
        docs_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.hub = hub

    # ---- Favicon & images (serve from your repo path) ----
    ICON_FILE = Path("/home/major/Desktop/aetherlink/images/icons/IMU_Icon.png")
    app.mount("/images", StaticFiles(directory="/home/major/Desktop/aetherlink/images"), name="images")

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon():
        if ICON_FILE.exists():
            return FileResponse(str(ICON_FILE), media_type="image/png")
        return Response(status_code=204)

    @app.get("/docs", include_in_schema=False)
    def custom_swagger_docs():
        if app.openapi_url is None:
            raise RuntimeError("OpenAPI schema is disabled.")
        return get_swagger_ui_html(
            openapi_url=str(app.openapi_url),
            title="WT901C IMU API – Docs",
            swagger_favicon_url="/favicon.ico",
        )

    @app.api_route("/", methods=["GET", "POST", "HEAD", "OPTIONS"], include_in_schema=False)
    def root_redirect() -> RedirectResponse:
        return RedirectResponse(url="/docs", status_code=307)

    # ---------------- Core Routes (unchanged semantics) ----------------

    @app.get("/snapshot")
    async def snapshot(types: Optional[str] = None):
        wanted = types.split(",") if types else SELECTABLE
        return hub.snapshot(wanted)

    @app.get("/last/{name}")
    async def last(name: str):
        n = name.lower()
        if n not in SELECTABLE:
            raise HTTPException(404, f"Unknown type '{name}'. Valid: {', '.join(SELECTABLE)}")
        if n not in hub.latest:
            raise HTTPException(404, f"No data yet for '{name}'.")
        return hub.latest[n]

    @app.get("/sse")
    async def sse(types: Optional[str] = None):
        wanted = types.split(",") if types else SELECTABLE
        async def event_gen():
            async for chunk in hub.sse_stream(wanted):
                yield chunk
        return StreamingResponse(event_gen(), media_type="text/event-stream")

    @app.websocket("/ws")
    async def ws(websocket: WebSocket):
        await websocket.accept()
        hub.ws_subs.add(websocket)
        try:
            while True:
                await asyncio.sleep(60)
        except WebSocketDisconnect:
            pass
        finally:
            hub.ws_subs.discard(websocket)

    @app.get("/debug/stats")
    async def stats():
        now = time.monotonic()
        uptime = now - hub.first_mono
        rates = {k: hub.counts[k] / max(1e-6, uptime) for k in hub.counts}
        ages  = {k: (now - hub.last_mono[k]) for k in hub.last_mono}
        return {"uptime_s": uptime, "rates_fps": rates, "ages_s": ages}

    @app.get("/health")
    async def health():
        """Extended health check with GPS and port status"""
        has_gps = "gps" in hub.latest
        has_ports = "dport" in hub.latest
        has_orientation = "orientation" in hub.latest
        return {
            "ok": True,
            "sensors": {
                "core_9axis": True,
                "gps": has_gps,
                "digital_ports": has_ports,
                "orientation": has_orientation
            },
            "uptime_s": time.monotonic() - hub.first_mono
        }

    # ---------------- Basic Configuration (unchanged) ----------------

    @app.post("/config/rate/{hz}")
    async def set_rate(hz: int):
        hub.imu.set_output_rate_hz(hz)
        return {"ok": True, "rate_hz": hz}

    @app.post("/config/baud/{code}")
    async def set_baud(code: int):
        if code < 0 or code > 4:
            return JSONResponse({"ok": False, "error": "code must be 0..4"}, status_code=400)
        hub.imu.set_baud_code(code)
        return {"ok": True, "baud_code": code, "note": "Reopen serial at new speed."}

    @app.post("/save")
    async def save():
        hub.imu.save_config()
        return {"ok": True}

    @app.post("/reset")
    async def reset():
        hub.imu.reset()
        return {"ok": True}

    @app.post("/calib/accel/{action}")
    async def calib_accel(action: str):
        act = action.lower()
        if act not in ("start", "stop"):
            return JSONResponse({"ok": False, "error": "use start|stop"}, status_code=400)
        (hub.imu.start_accel_calibration() if act == "start" else hub.imu.stop_accel_calibration())
        return {"ok": True, "accel_calib": act}

    @app.post("/calib/mag/{action}")
    async def calib_mag(action: str):
        act = action.lower()
        if act not in ("start", "stop"):
            return JSONResponse({"ok": False, "error": "use start|stop"}, status_code=400)
        (hub.imu.start_mag_calibration() if act == "start" else hub.imu.stop_mag_calibration())
        return {"ok": True, "mag_calib": act}

    @app.post("/config/content/{mask}")
    async def set_content(mask: int):
        if not (0 <= mask <= 0xFF):
            return JSONResponse({"ok": False, "error": "mask must be 0..255"}, status_code=400)
        hub.set_output_content_mask(mask)
        return {"ok": True, "mask": mask}

    # ---------------- Advanced Configuration (unchanged) ----------------

    @app.post("/config/unlock")
    async def unlock():
        hub.imu.unlock()
        return {"ok": True, "note": "Configuration unlocked. Remember to save and lock after changes."}

    @app.post("/config/lock")
    async def lock():
        hub.imu.lock()
        return {"ok": True, "note": "Configuration locked"}

    @app.post("/config/installation_direction/{direction}")
    async def set_installation_direction(direction: str):
        dir_map = {"horizontal": AXIS_DIR_HORIZONTAL, "vertical": AXIS_DIR_VERTICAL}
        if direction.lower() not in dir_map:
            raise HTTPException(400, "direction must be 'horizontal' or 'vertical'")
        hub.imu.set_installation_direction(dir_map[direction.lower()])
        return {"ok": True, "direction": direction}

    @app.post("/config/gyro_auto_cal/{enable}")
    async def set_gyro_auto_cal(enable: bool):
        hub.imu.set_gyro_auto_calibration(enable)
        return {"ok": True, "gyro_auto_cal": enable}

    @app.post("/config/angle_reference")
    async def set_angle_reference(axis: str = "z"):
        if axis.lower() not in ("x", "y", "z", "all"):
            raise HTTPException(400, "axis must be 'x', 'y', 'z', or 'all'")
        hub.imu.set_angle_reference(axis)
        return {"ok": True, "angle_reference": axis}

    @app.post("/config/advanced")
    async def configure_advanced(
        rate_hz: Optional[int] = None,
        content_mask: Optional[int] = None,
        installation_direction: Optional[str] = None,
        gyro_auto_cal: Optional[bool] = None
    ):
        dir_map = {"horizontal": AXIS_DIR_HORIZONTAL, "vertical": AXIS_DIR_VERTICAL}
        if installation_direction and installation_direction.lower() not in dir_map:
            raise HTTPException(400, "installation_direction must be 'horizontal' or 'vertical'")
        inst_dir_code = None
        if installation_direction:
            inst_dir_code = dir_map[installation_direction.lower()]
        hub.imu.configure_advanced(
            rate_hz=rate_hz,
            content_mask=content_mask,
            installation_dir=inst_dir_code,
            gyro_auto_cal=gyro_auto_cal
        )
        return {
            "ok": True,
            "configured": {
                "rate_hz": rate_hz,
                "content_mask": content_mask,
                "installation_direction": installation_direction,
                "gyro_auto_cal": gyro_auto_cal
            }
        }

    @app.post("/calib/full")
    async def calibrate_full(
        accel: bool = False,
        mag: bool = False,
        angle_ref: Optional[str] = None,
        duration: float = 10.0
    ):
        if angle_ref and angle_ref.lower() not in ("x", "y", "z", "all"):
            raise HTTPException(400, "angle_ref must be 'x', 'y', 'z', 'all', or null")
        if duration < 1 or duration > 60:
            raise HTTPException(400, "duration must be 1-60 seconds")
        def run_calib():
            hub.imu.calibrate_with_config(
                accel=accel,
                mag=mag,
                angle_ref=angle_ref,
                duration=duration
            )
        asyncio.create_task(asyncio.to_thread(run_calib))
        return {"ok": True, "note": f"Calibration started ({duration}s)", "params": {
            "accel": accel, "mag": mag, "angle_ref": angle_ref, "duration": duration
        }}

    # ---------------- NEW: Orientation & Declination Routes ----------------

    @app.get("/orientation")
    async def get_orientation():
        """
        Latest computed orientation (dish body frame):
        - heading_mag_deg: magnetic heading (0..360)
        - heading_true_deg: true heading = magnetic + declination
        - cross_level_deg: roll about boresight (≈ ±10°)
        - elevation_deg: pitch about right axis (positive up)
        - declination_*: value/source/timestamp
        - heading_offset_deg: fixed offset applied before declination
        """
        o = hub.imu.orientation_json()
        if not o:
            raise HTTPException(404, "Orientation not available yet (need ACC+MAG).")
        return o

    @app.post("/orientation/declination/{deg}")
    async def set_declination_manual(deg: float):
        """
        Manually set magnetic declination (degrees, east positive).
        Use this if you don't have a GPS-driven provider.
        """
        hub.imu.set_declination_deg(deg)
        # Recompute orientation right away for UI responsiveness
        hub._publish_orientation()
        return {"ok": True, "declination_deg": deg, "source": "manual"}

    @app.post("/orientation/offset/{deg}")
    async def set_heading_offset(deg: float):
        """
        Set a fixed heading offset (degrees) so current pose reads ~0°.
        Typical workflow:
        - Place dish in your reference 'North' pose
        - Sample heading_mag from /orientation, set offset = -heading_mag (wrapped 0..360)
        """
        hub.imu.set_heading_offset_deg(deg)
        hub._publish_orientation()
        return {"ok": True, "heading_offset_deg": deg}

    @app.post("/orientation/declination/gps")
    async def declination_from_gps(
        lat: float = Body(..., embed=True),
        lon: float = Body(..., embed=True),
        alt_m: float = Body(0.0, embed=True),
        timestamp_iso: Optional[str] = Body(None, embed=True),
    ):
        """
        Update declination from GPS position/time.

        IMPORTANT:
        - This calls into the library's `update_declination_from_gps()` which
          expects a **declination provider** to be registered via
          `set_declination_provider(fn)`. If no provider is set, this endpoint is a NO-OP
          (keeps the last declination and returns 'manual' as the source).
        - This design avoids bundling heavy geomagnetic models into your API.
          If you later add a provider, this endpoint will begin updating declination.

        Body:
        { "lat": 52.52, "lon": 13.405, "alt_m": 45.0, "timestamp_iso": "2025-10-22T16:41:00Z" }
        """
        dt = None
        if timestamp_iso:
            try:
                dt = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00"))
            except Exception:
                raise HTTPException(400, "timestamp_iso must be ISO8601, e.g. 2025-10-22T16:41:00Z")
        # Safe if no provider registered
        hub.imu.update_declination_from_gps(lat, lon, alt_m, dt)
        hub._publish_orientation()
        dec_deg, src, ts = hub.imu.get_declination_info()
        return {"ok": True, "declination_deg": dec_deg, "source": src, "timestamp_utc": ts}

    return app

# ---------- Entrypoint ----------

def _env_or(default: str, key: str) -> str:
    return os.environ.get(key, default)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WT901C IMU API server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--serial", default=_env_or("/dev/imu", "IMU_PORT"))
    parser.add_argument("--baud", type=int, default=int(_env_or("115200", "IMU_BAUD")))
    args = parser.parse_args()

    app = create_app(port=args.serial, baud=args.baud)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
