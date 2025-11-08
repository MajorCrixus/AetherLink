#!/usr/bin/env python3
"""
FastAPI service for MKS SERVO57D (RS-485, native FA/FB protocol).

Endpoints (high level)
----------------------
GET  /health                         -> {"ok": true}
GET  /snapshot?types=enc,speed,io,status,err,angle
GET  /last/{name}                    -> latest single item (enc|speed|io|status|err|angle)
GET  /sse?types=enc,speed,io,status  -> Server-Sent Events (JSON lines)
WS   /ws                              -> WebSocket push of polled data

Motion
------
POST /enable/{on}                    -> on ∈ {0,1}
POST /estop
POST /motion/speed                   -> JSON { ccw: bool, rpm: int, acc: int }
POST /motion/stop                    -> JSON { acc: int = 0 }
POST /motion/rel/deg                 -> JSON { degrees: float, rpm: int, acc: int }
POST /motion/abs/deg                 -> JSON { target_deg: float, rpm: int, acc: int }
POST /motion/rel/axis                -> JSON { ticks: int, rpm: int, acc: int }
POST /motion/abs/axis                -> JSON { axis: int, rpm: int, acc: int }

Homing / zero
-------------
POST /home
POST /zero
POST /single_turn_home

I/O
---
GET  /io                              -> {"IN1": bool, "IN2": bool, "OUT1": bool, "OUT2": bool}
POST /io                               -> JSON { out1: 0|1|null, out2: 0|1|null, hold_others: true|false }

Config (selected)
-----------------
POST /config/mode/{mode}             -> mode ∈ {0..5}  (see Mode in library)
POST /config/dir/{d}                 -> d ∈ {0=CW,1=CCW}
POST /config/en_active/{v}           -> v ∈ {0=ACTIVE_LOW,1=ACTIVE_HIGH,2=ALWAYS_ON}
POST /config/current_ma/{ma}
POST /config/hold_current_pct/{pct}  -> 10..90 (maps to 9 steps)
POST /config/microstep/{m}
POST /config/baud_code/{code}        -> device baud code (1..7)
POST /config/addr/{new_addr}
POST /config/respond                  -> JSON { respond_enable: bool, active_enable: bool }
POST /config/limits/{enable}         -> firmware limits on IN1/IN2
POST /config/restart
POST /config/factory_reset

Advanced v1.0.6 Config
----------------------
POST /config/limit_polarity          -> JSON { cw_active_low: bool, ccw_active_low: bool }
POST /config/limit_function          -> JSON { cw_enable: bool, ccw_enable: bool }
POST /config/zero_return_speed/{rpm} -> 0..3000
POST /config/key_switch/{enable}     -> 0|1 (front panel button)
POST /config/home_trigger_mode/{mode} -> 0=level, 1=edge
POST /config/pos_error_threshold/{ticks} -> position error threshold

Calibration
-----------
POST /calibrate_zero                 -> set current position as encoder zero

Notes
-----
- Requires: pip install fastapi uvicorn pydantic
- RS-485: connect via USB↔RS485 or HAT. Defaults: SERVO_BAUD=38400, SERVO_ADDR=1
- The service polls the drive at SERVO_POLL_HZ (default 10 Hz) on a background thread.
"""

from __future__ import annotations

import os
import json
import time
import asyncio
import argparse
import contextlib
from dataclasses import asdict
from pathlib import Path
from typing import Dict, Optional, Iterable, List, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.responses import JSONResponse, StreamingResponse, RedirectResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field

# ---- Import your library (same package) ----
from .mks_servo57d_lib import (
    MKSServo57D, Mode, Dir, EnActive, IOFlags,
    degrees_to_axis_ticks, axis_ticks_to_degrees,
    MKSProtocolError, MKSNoResponse, MKSChecksumError
)

# ------------- Helpers -------------

SELECTABLE = ("enc", "speed", "io", "status", "err", "angle")

def _env_str(key: str, default: str) -> str:
    return os.environ.get(key, default)

def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, str(default)))
    except Exception:
        return default

def _now_mono() -> float:
    return time.monotonic()

def _io_to_dict(flags: IOFlags, inputs_active_low: bool = True) -> Dict[str, bool]:
    # IN1/IN2 come as bits; many setups wire active-low switches
    raw_in1 = bool(flags & IOFlags.IN1)
    raw_in2 = bool(flags & IOFlags.IN2)
    in1 = (not raw_in1) if inputs_active_low else raw_in1
    in2 = (not raw_in2) if inputs_active_low else raw_in2
    return {
        "IN1": in1,
        "IN2": in2,
        "OUT1": bool(flags & IOFlags.OUT1),
        "OUT2": bool(flags & IOFlags.OUT2),
    }

# ------------- Hub: bridge polling thread -> asyncio world -------------

class ServoHub:
    def __init__(self, port: str, baud: int, addr: int, poll_hz: int = 10):
        self.port = port
        self.baud = baud
        self.addr = addr & 0xFF
        self.poll_dt = 1.0 / max(1, poll_hz)

        self.servo = MKSServo57D(port=port, baud=baud)
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._running = False
        self._th: Optional[asyncio.Thread] = None

        self.latest: Dict[str, Dict] = {}
        self.sse_subs: Set[asyncio.Queue] = set()
        self.ws_subs: Set[WebSocket] = set()

    def attach_loop(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop

    def start(self):
        if self._running:
            return
        import threading
        self._running = True
        self._th = threading.Thread(target=self._poller, name="Servo57D-Poller", daemon=True)
        self._th.start()

    def stop(self):
        self._running = False

    def close(self):
        with contextlib.suppress(Exception):
            self.servo.close()

    def _publish(self, name: str, msg: Dict):
        # update cache
        self.latest[name] = msg

        # SSE queues
        dead_q: List[asyncio.Queue] = []
        for q in list(self.sse_subs):
            try:
                q.put_nowait(msg)
            except Exception:
                dead_q.append(q)
        for q in dead_q:
            self.sse_subs.discard(q)

        # websockets
        async def _send(ws: WebSocket, payload: Dict):
            with contextlib.suppress(Exception):
                await ws.send_json(payload)

        for ws in list(self.ws_subs):
            try:
                asyncio.create_task(_send(ws, msg))
            except Exception:
                self.ws_subs.discard(ws)

    def _poll_once(self):
        a = self.addr
        # defensive: each read can fail independently
        try:
            carry = self.servo.read_encoder_carry(a)
            msg = {"type": "enc", "ts": _now_mono(), "data": {"carry": carry.carry, "value": carry.value}}
            self.loop and self.loop.call_soon_threadsafe(self._publish, "enc", msg)
        except Exception:
            pass

        try:
            rpm = self.servo.read_speed_rpm(a)
            msg = {"type": "speed", "ts": _now_mono(), "data": {"rpm": rpm}}
            self.loop and self.loop.call_soon_threadsafe(self._publish, "speed", msg)
        except Exception:
            pass

        try:
            io = self.servo.read_io(a)
            msg = {"type": "io", "ts": _now_mono(), "data": _io_to_dict(io)}
            self.loop and self.loop.call_soon_threadsafe(self._publish, "io", msg)
        except Exception:
            pass

        try:
            st = int(self.servo.query_status(a))
            msg = {"type": "status", "ts": _now_mono(), "data": {"state": st}}
            self.loop and self.loop.call_soon_threadsafe(self._publish, "status", msg)
        except Exception:
            pass

        try:
            err = self.servo.read_axis_error(a)
            msg = {"type": "err", "ts": _now_mono(), "data": {"axis_error": err}}
            self.loop and self.loop.call_soon_threadsafe(self._publish, "err", msg)
        except Exception:
            pass

        try:
            # convenience: angle from 48-bit addition counter
            angle_deg = self.servo.read_angle_degrees(a)
            msg = {"type": "angle", "ts": _now_mono(), "data": {"deg": angle_deg}}
            self.loop and self.loop.call_soon_threadsafe(self._publish, "angle", msg)
        except Exception:
            pass

    def _poller(self):
        # slow-start: give serial a breath
        time.sleep(0.05)
        while self._running:
            try:
                self._poll_once()
            except Exception:
                # swallow, keep thread alive
                pass
            time.sleep(self.poll_dt)

    def snapshot(self, types: Iterable[str]) -> Dict[str, Dict]:
        out: Dict[str, Dict] = {}
        for t in (types or []):
            name = t.lower()
            if name in self.latest:
                out[name] = self.latest[name]
        return {"ts": {"mono": _now_mono()}, **out}

    async def sse_stream(self, types: Iterable[str]):
        wanted = set(t.lower() for t in types) if types else set(SELECTABLE)
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self.sse_subs.add(q)
        try:
            # initial snapshot
            snap = self.snapshot(wanted)
            yield f"data: {json.dumps(snap)}\n\n"
            # live updates
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=5.0)
                    if msg.get("type") in wanted:
                        yield f"data: {json.dumps(msg)}\n\n"
                except asyncio.TimeoutError:
                    yield "event: ping\ndata: {}\n\n"
        finally:
            self.sse_subs.discard(q)

# ------------- Pydantic models -------------

class SpeedBody(BaseModel):
    ccw: bool = Field(..., description="True = CCW, False = CW")
    rpm: int = Field(..., ge=0, le=3000)
    acc: int = Field(..., ge=0, le=255)

class StopBody(BaseModel):
    acc: int = Field(0, ge=0, le=255)

class RelDegBody(BaseModel):
    degrees: float
    rpm: int = Field(..., ge=0, le=3000)
    acc: int = Field(..., ge=0, le=255)

class AbsDegBody(BaseModel):
    target_deg: float
    rpm: int = Field(..., ge=0, le=3000)
    acc: int = Field(..., ge=0, le=255)

class RelAxisBody(BaseModel):
    ticks: int
    rpm: int = Field(..., ge=0, le=3000)
    acc: int = Field(..., ge=0, le=255)

class AbsAxisBody(BaseModel):
    axis: int
    rpm: int = Field(..., ge=0, le=3000)
    acc: int = Field(..., ge=0, le=255)

class IOBody(BaseModel):
    out1: Optional[int] = Field(None, description="0/1 or omit to leave unchanged")
    out2: Optional[int] = Field(None, description="0/1 or omit to leave unchanged")
    hold_others: bool = True

class RespondBody(BaseModel):
    respond_enable: bool = True
    active_enable: bool = True

# ------------- App factory -------------

def create_app(port: str, baud: int, addr: int, poll_hz: int) -> FastAPI:
    hub = ServoHub(port=port, baud=baud, addr=addr, poll_hz=poll_hz)

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
        title="MKS SERVO57D API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None,  # custom docs so we can set favicon
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.hub = hub

    # ---- Favicon & optional /images mount (avoid 404 spam) ----
    # Use a repo icon if present; otherwise return 204.
    ICON_FILE = Path("/home/major/Desktop/aetherlink/images/icons/Servo_Icon.png")
    if (Path("/home/major/Desktop/aetherlink/images")).exists():
        app.mount("/images", StaticFiles(directory="/home/major/Desktop/aetherlink/images"), name="images")

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon():
        if ICON_FILE.exists():
            return FileResponse(str(ICON_FILE), media_type="image/png")
        return Response(status_code=204)

    @app.get("/docs", include_in_schema=False)
    def docs():
        return get_swagger_ui_html(
            openapi_url=str(app.openapi_url),
            title="MKS SERVO57D API – Docs",
            swagger_favicon_url="/favicon.ico",
        )

    @app.api_route("/", methods=["GET", "POST", "HEAD", "OPTIONS"], include_in_schema=False)
    def root_redirect() -> RedirectResponse:
        return RedirectResponse("/docs", status_code=307)

    # ---- Simple endpoints ----
    @app.get("/health")
    async def health():
        return {"ok": True}

    @app.get("/snapshot")
    async def snapshot(types: Optional[str] = None):
        wanted = types.split(",") if types else SELECTABLE
        return hub.snapshot(wanted)

    @app.get("/last/{name}")
    async def last(name: str):
        key = name.lower()
        if key not in SELECTABLE:
            raise HTTPException(404, f"Unknown type '{name}'. Valid: {', '.join(SELECTABLE)}")
        if key not in hub.latest:
            raise HTTPException(404, f"No data yet for '{name}'.")
        return hub.latest[key]

    @app.get("/sse")
    async def sse(types: Optional[str] = None):
        wanted = types.split(",") if types else SELECTABLE
        async def gen():
            async for chunk in hub.sse_stream(wanted):
                yield chunk
        return StreamingResponse(gen(), media_type="text/event-stream")

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

    # ---- Motion ----
    @app.post("/enable/{on}")
    async def enable(on: int):
        try:
            code = hub.servo.enable(hub.addr, bool(on))
            return {"ok": code == 1, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/estop")
    async def estop():
        try:
            code = hub.servo.emergency_stop(hub.addr)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/motion/speed")
    async def motion_speed(body: SpeedBody):
        try:
            code = hub.servo.run_speed_mode(hub.addr, dir_ccw=body.ccw, speed_rpm=body.rpm, acc=body.acc)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/motion/stop")
    async def motion_stop(body: StopBody = Body(default=StopBody())):
        try:
            code = hub.servo.stop_speed_mode(hub.addr, acc=body.acc)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/motion/rel/deg")
    async def motion_rel_deg(body: RelDegBody):
        try:
            code = hub.servo.move_relative_degrees(hub.addr, speed_rpm=body.rpm, acc=body.acc, degrees=body.degrees)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/motion/abs/deg")
    async def motion_abs_deg(body: AbsDegBody):
        try:
            code = hub.servo.move_to_degrees(hub.addr, speed_rpm=body.rpm, acc=body.acc, target_deg=body.target_deg)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/motion/rel/axis")
    async def motion_rel_axis(body: RelAxisBody):
        try:
            code = hub.servo.move_axis_relative(hub.addr, speed_rpm=body.rpm, acc=body.acc, rel_axis_ticks=body.ticks)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/motion/abs/axis")
    async def motion_abs_axis(body: AbsAxisBody):
        try:
            code = hub.servo.move_axis_absolute(hub.addr, speed_rpm=body.rpm, acc=body.acc, abs_axis_ticks=body.axis)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    # ---- Homing / zero ----
    @app.post("/home")
    async def home():
        try:
            code = hub.servo.go_home(hub.addr)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/zero")
    async def zero():
        try:
            code = hub.servo.set_axis_zero(hub.addr)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/single_turn_home")
    async def single_turn_home():
        try:
            code = hub.servo.single_turn_home(hub.addr)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    # ---- IO ----
    @app.get("/io")
    async def io_get():
        try:
            flags = hub.servo.read_io(hub.addr)
            return {"ok": True, **_io_to_dict(flags)}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    @app.post("/io")
    async def io_post(body: IOBody):
        try:
            code = hub.servo.write_io(hub.addr, out1=body.out1, out2=body.out2, hold_others=body.hold_others)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=502)

    # ---- Config ----
    @app.post("/config/mode/{mode}")
    async def cfg_mode(mode: int):
        try:
            code = hub.servo.set_mode(hub.addr, Mode(mode))
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/dir/{d}")
    async def cfg_dir(d: int):
        try:
            code = hub.servo.set_dir(hub.addr, Dir(d))
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/en_active/{v}")
    async def cfg_en_active(v: int):
        try:
            code = hub.servo.set_en_active(hub.addr, EnActive(v))
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/current_ma/{ma}")
    async def cfg_current(ma: int):
        try:
            code = hub.servo.set_current_ma(hub.addr, ma)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/hold_current_pct/{pct}")
    async def cfg_hold_current(pct: int):
        try:
            code = hub.servo.set_hold_current_percent(hub.addr, pct)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/microstep/{m}")
    async def cfg_microstep(m: int):
        try:
            code = hub.servo.set_microstep(hub.addr, m)
            return {"ok": True, "code": code}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/baud_code/{code}")
    async def cfg_baud_code(code: int):
        try:
            c = hub.servo.set_baud_code(hub.addr, code)
            return {"ok": True, "code": c, "note": "Reopen RS-485 host at new baud."}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/addr/{new_addr}")
    async def cfg_addr(new_addr: int):
        try:
            c = hub.servo.set_slave_addr(hub.addr, new_addr)
            return {"ok": True, "code": c, "old_addr": hub.addr, "new_addr": new_addr}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/respond")
    async def cfg_respond(body: RespondBody):
        try:
            c = hub.servo.set_respond_active(hub.addr, body.respond_enable, body.active_enable)
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/limits/{enable}")
    async def cfg_limits(enable: int):
        try:
            c = hub.servo.enable_firmware_limits(hub.addr, bool(enable))
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/restart")
    async def cfg_restart():
        try:
            c = hub.servo.restart_motor(hub.addr)
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/factory_reset")
    async def cfg_factory():
        try:
            c = hub.servo.restore_factory(hub.addr)
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    # ---- Advanced v1.0.6 Config ----
    @app.post("/config/limit_polarity")
    async def cfg_limit_polarity(cw_active_low: bool = True, ccw_active_low: bool = True):
        """Set limit switch polarity (active-low vs active-high)."""
        try:
            c = hub.servo.set_limit_port_polarity(hub.addr, cw_active_low, ccw_active_low)
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/limit_function")
    async def cfg_limit_function(cw_enable: bool = True, ccw_enable: bool = True):
        """Enable/disable CW and CCW limit switches."""
        try:
            c = hub.servo.set_limit_port_function(hub.addr, cw_enable, ccw_enable)
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/zero_return_speed/{rpm}")
    async def cfg_zero_return_speed(rpm: int):
        """Set speed for homing/zero-return operations (0-3000 RPM)."""
        try:
            c = hub.servo.set_zero_return_speed(hub.addr, rpm)
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/key_switch/{enable}")
    async def cfg_key_switch(enable: int):
        """Enable/disable front panel button."""
        try:
            c = hub.servo.set_key_switch_mode(hub.addr, bool(enable))
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/home_trigger_mode/{mode}")
    async def cfg_home_trigger(mode: int):
        """Set home trigger mode (0=level, 1=edge)."""
        try:
            c = hub.servo.set_home_trigger_mode(hub.addr, mode)
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    @app.post("/config/pos_error_threshold/{ticks}")
    async def cfg_pos_error_threshold(ticks: int):
        """Set position error protection threshold (axis ticks)."""
        try:
            c = hub.servo.set_pos_error_threshold(hub.addr, ticks)
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    # ---- Calibration ----
    @app.post("/calibrate_zero")
    async def calibrate_zero():
        """Calibrate encoder zero position (set current position as absolute zero)."""
        try:
            c = hub.servo.calibrate_zero_position(hub.addr)
            return {"ok": True, "code": c}
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

    return app

# ------------- Entrypoint -------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MKS SERVO57D API server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8083)
    parser.add_argument("--serial", default=_env_str("SERVO_PORT", "/dev/rs485"))
    parser.add_argument("--baud", type=int, default=_env_int("SERVO_BAUD", 38400))
    parser.add_argument("--addr", type=int, default=_env_int("SERVO_ADDR", 1))
    parser.add_argument("--poll-hz", type=int, default=_env_int("SERVO_POLL_HZ", 10))
    args = parser.parse_args()

    app = create_app(port=args.serial, baud=args.baud, addr=args.addr, poll_hz=args.poll_hz)
    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
