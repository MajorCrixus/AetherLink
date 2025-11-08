#!/usr/bin/env python3
import asyncio
import contextlib
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Make repo root importable (keep until you package/install the project)
ROOT = Path(__file__).resolve().parents[2]  # adjust if your layout differs
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.core.config import settings
from backend.core.database import init_db
from backend.api import api_router
from backend.services.telemetry_service import TelemetryService
from backend.services.websocket_manager import WebSocketManager

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("aetherlink.main")

# Globals set during lifespan
telemetry_service: TelemetryService | None = None
websocket_manager: WebSocketManager | None = None
_telemetry_task: asyncio.Task | None = None  # keep handle for error logging/cancel

@asynccontextmanager
async def lifespan(app: FastAPI):
    global telemetry_service, websocket_manager, _telemetry_task

    logger.info("Starting AetherLink backend…")
    await init_db()

    websocket_manager = WebSocketManager()
    telemetry_service = TelemetryService(websocket_manager)

    app.state.telemetry_service = telemetry_service
    app.state.websocket_manager = websocket_manager

    # Avoid import cycles by injecting here
    from backend.api.endpoints.servos import set_telemetry_service
    set_telemetry_service(telemetry_service)

    # Start background telemetry
    async def _run_telemetry():
        await telemetry_service.start()

    _telemetry_task = asyncio.create_task(_run_telemetry(), name="telemetry_service")

    def _on_done(task: asyncio.Task):
        try:
            task.result()
        except asyncio.CancelledError:
            logger.info("Telemetry task cancelled")
        except Exception as e:
            logger.exception("Telemetry task crashed: %s", e)

    _telemetry_task.add_done_callback(_on_done)
    logger.info("AetherLink backend started (hardware init in background)")
    yield

    logger.info("Shutting down AetherLink backend…")
    if telemetry_service:
        try:
            await telemetry_service.stop()
        except Exception:
            logger.exception("Error stopping telemetry service")

    if _telemetry_task and not _telemetry_task.done():
        _telemetry_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _telemetry_task

    logger.info("Shutdown complete")

app = FastAPI(
    title="AetherLink SATCOM Control",
    description="Ground-based satellite tracking antenna control system",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
allowed = settings.ALLOWED_ORIGINS
allow_creds = True
# If wildcard, disable credentials to satisfy browser CORS requirements
if allowed == ["*"] or allowed == "*":
    allow_creds = False
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed if isinstance(allowed, list) else [allowed],
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API
app.include_router(api_router, prefix="/api")

# WebSockets
@app.websocket("/ws/telemetry")
async def telemetry_ws(ws: WebSocket):
    client_id = None
    try:
        await ws.accept()
        if websocket_manager is None:
            await ws.close()
            return
        client_id = await websocket_manager.connect(ws, "telemetry")
        while True:
            try:
                # 1s recv timeout to detect disconnects without busy loop
                await asyncio.wait_for(ws.receive_text(), timeout=1.0)
            except asyncio.TimeoutError:
                # Keepalive tick—your TelemetryService should be pushing
                continue
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket /ws/telemetry error (client %s)", client_id)
    finally:
        if client_id and websocket_manager:
            websocket_manager.disconnect(client_id)

@app.websocket("/ws/logs")
async def logs_ws(ws: WebSocket):
    await ws.accept()
    if websocket_manager is None:
        await ws.close()
        return
    client_id = await websocket_manager.connect(ws, "logs")
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    finally:
        websocket_manager.disconnect(client_id)

# Static frontend (production only - in dev, use Vite on port 3001)
if not settings.DEBUG:
    FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if FRONTEND_DIR.exists():
        app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
        logger.info("Serving frontend static files from %s", FRONTEND_DIR)
    else:
        logger.warning("Frontend dist directory not found at %s", FRONTEND_DIR)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "services": {
            "telemetry": bool(telemetry_service and getattr(telemetry_service, "is_running", False)),
            "websocket": int(getattr(websocket_manager, "client_count", 0) or 0),
        },
    }

if __name__ == "__main__":
    # Use import string for reload, or the app object otherwise.
    uvicorn.run(
        "backend.main:app" if settings.DEBUG else app,
        host=settings.HOST,
        port=int(settings.PORT),
        reload=bool(settings.DEBUG),
        log_level=str(settings.LOG_LEVEL).lower(),
    )
