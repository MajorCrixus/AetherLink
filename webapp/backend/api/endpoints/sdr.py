"""
SDR API Endpoints

REST API and WebSocket endpoints for HackRF One control and signal monitoring
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import asyncio
import logging

from hardware.sdr.code_library.hackrf_manager import sdr_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sdr", tags=["sdr"])


# Request/Response Models
class MonitoringRequest(BaseModel):
    """Request to start signal monitoring"""
    frequency: float = Field(..., description="Center frequency in MHz", ge=1.0, le=6000.0)
    gain_lna: int = Field(16, description="LNA gain in dB (0-40, steps of 8)", ge=0, le=40)
    gain_vga: int = Field(20, description="VGA gain in dB (0-62, steps of 2)", ge=0, le=62)
    amp_enabled: bool = Field(False, description="Enable RF amplifier (+14 dB)")
    bandwidth: float = Field(1.0, description="Sweep bandwidth in MHz", ge=0.01, le=20.0)


class DeviceInfoResponse(BaseModel):
    """HackRF device information"""
    connected: bool
    serial: Optional[str] = None
    firmware: Optional[str] = None
    board_id: Optional[str] = None
    error: Optional[str] = None


class MonitoringStatusResponse(BaseModel):
    """Monitoring status response"""
    status: str
    message: str
    settings: Optional[dict] = None


class SignalDataResponse(BaseModel):
    """Signal strength data"""
    status: str
    timestamp: Optional[str] = None
    frequency_mhz: Optional[float] = None
    power_dbm: float
    message: Optional[str] = None


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.monitoring_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket client connected (total: %d)", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info("WebSocket client disconnected (total: %d)", len(self.active_connections))

    async def broadcast(self, data: dict):
        """Send data to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.warning("Error sending to client: %s", e)
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

    async def start_signal_streaming(self, interval: float = 0.5):
        """Start streaming signal data to connected clients"""
        logger.info("Starting signal streaming (interval: %.1f s)", interval)

        try:
            while sdr_manager.is_monitoring() and self.active_connections:
                # Get current signal strength
                signal_data = await sdr_manager.get_signal_strength()

                # Broadcast to all clients
                await self.broadcast(signal_data)

                # Wait before next sample
                await asyncio.sleep(interval)

        except asyncio.CancelledError:
            logger.info("Signal streaming cancelled")
        except Exception as e:
            logger.error("Error in signal streaming: %s", e)
        finally:
            logger.info("Signal streaming stopped")

    def start_monitoring_task(self, interval: float = 0.5):
        """Start background task for signal monitoring"""
        if self.monitoring_task is None or self.monitoring_task.done():
            self.monitoring_task = asyncio.create_task(
                self.start_signal_streaming(interval)
            )

    def stop_monitoring_task(self):
        """Stop background monitoring task"""
        if self.monitoring_task and not self.monitoring_task.done():
            self.monitoring_task.cancel()
            self.monitoring_task = None


manager = ConnectionManager()


# REST Endpoints

@router.get("/device", response_model=DeviceInfoResponse)
async def get_device_info():
    """
    Get HackRF device information

    Runs hackrf_info to detect and identify connected HackRF device
    """
    device_info = await sdr_manager.get_device_info()
    return device_info


@router.post("/start", response_model=MonitoringStatusResponse)
async def start_monitoring(request: MonitoringRequest):
    """
    Start signal monitoring at specified frequency

    Begins monitoring the specified frequency with configured gain settings.
    Signal data will be streamed via WebSocket to connected clients.
    """
    result = await sdr_manager.start_monitoring(
        frequency=request.frequency,
        gain_lna=request.gain_lna,
        gain_vga=request.gain_vga,
        amp_enabled=request.amp_enabled,
        bandwidth=request.bandwidth
    )

    if result['status'] == 'error':
        raise HTTPException(status_code=400, detail=result['message'])

    # Start streaming to WebSocket clients if any are connected
    if manager.active_connections:
        manager.start_monitoring_task(interval=0.5)

    return result


@router.post("/stop", response_model=MonitoringStatusResponse)
async def stop_monitoring():
    """
    Stop signal monitoring

    Stops the current monitoring session
    """
    # Stop streaming task
    manager.stop_monitoring_task()

    result = await sdr_manager.stop_monitoring()
    return result


@router.get("/signal", response_model=SignalDataResponse)
async def get_signal_strength():
    """
    Get current signal strength (single measurement)

    Returns the current signal strength at the monitored frequency.
    Requires active monitoring session.
    """
    if not sdr_manager.is_monitoring():
        raise HTTPException(status_code=400, detail="Not monitoring")

    signal_data = await sdr_manager.get_signal_strength()

    if signal_data['status'] == 'error':
        raise HTTPException(status_code=500, detail=signal_data.get('message', 'Unknown error'))

    return signal_data


@router.get("/status")
async def get_monitoring_status():
    """
    Get current monitoring status

    Returns whether monitoring is active and current settings
    """
    return {
        'monitoring': sdr_manager.is_monitoring(),
        'settings': sdr_manager.get_current_settings(),
        'websocket_clients': len(manager.active_connections)
    }


# WebSocket Endpoint

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time signal data streaming

    Clients connect to receive continuous signal strength updates
    while monitoring is active.

    Message format:
    {
        "status": "success",
        "timestamp": "2024-01-01T12:00:00",
        "frequency_mhz": 137.62,
        "power_dbm": -75.3
    }
    """
    await manager.connect(websocket)

    try:
        # Start streaming if monitoring is active
        if sdr_manager.is_monitoring():
            manager.start_monitoring_task(interval=0.5)

        # Keep connection alive and handle incoming messages
        while True:
            # Wait for messages from client (e.g., ping/pong)
            data = await websocket.receive_text()

            # Echo back for now (can add commands later)
            await websocket.send_json({
                "type": "ack",
                "message": "received",
                "data": data
            })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected normally")

    except Exception as e:
        logger.error("WebSocket error: %s", e)
        manager.disconnect(websocket)

    finally:
        # Stop monitoring task if no clients remain
        if not manager.active_connections:
            manager.stop_monitoring_task()
