"""
Telemetry data endpoints
"""

from typing import Optional, List
from datetime import datetime, timezone, timedelta
from enum import Enum

from fastapi import APIRouter, Query, Request, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/telemetry", tags=["telemetry"])

# ---------- Response models ----------

class GpsModel(BaseModel):
    mode: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    alt_m: Optional[float] = None
    hdop: Optional[float] = None
    sats: int
    ts: str

class ImuModel(BaseModel):
    roll_deg: float
    pitch_deg: float
    yaw_deg: float
    temp_c: Optional[float] = None
    ts: str

class AxisState(BaseModel):
    target_deg: float
    actual_deg: float
    error_deg: float
    rate_dps: float
    ts: str

class ServoState(BaseModel):
    axis: str
    mode: str
    current_ma: int
    temp_c: float
    error_code: Optional[int] = None
    ts: str

class LimitState(BaseModel):
    in1: Optional[bool]
    in2: Optional[bool]
    ts: str

class SystemModel(BaseModel):
    cpu: float
    gpu: float
    mem: float
    disk: float
    temps: dict
    ts: str

class TelemetrySnapshot(BaseModel):
    timestamp: str
    gps: GpsModel
    imu: ImuModel
    axes: dict
    servos: dict
    limits: dict
    system: SystemModel
    selected_satellite: Optional[dict] = None

class HealthItem(BaseModel):
    status: str
    message: str
    last_update: str

class HealthStatus(BaseModel):
    link: HealthItem
    gps: HealthItem
    imu: HealthItem
    servos: HealthItem
    limits: HealthItem
    tle: HealthItem
    time: HealthItem
    system: HealthItem
    sim: HealthItem

class HistoryResolution(str, Enum):
    s1 = "1s"
    m1 = "1m"
    m5 = "5m"
    h1 = "1h"

class HistoryPoint(BaseModel):
    timestamp: str
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    az_deg: Optional[float] = None
    el_deg: Optional[float] = None
    cpu_percent: Optional[float] = None

class HistoryResponse(BaseModel):
    start_time: str
    end_time: str
    resolution: HistoryResolution
    data_points: int
    data: List[HistoryPoint]

# ---------- Helpers ----------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def _mock_snapshot() -> TelemetrySnapshot:
    ts = "2024-01-01T00:00:00Z"
    return TelemetrySnapshot(
        timestamp=ts,
        gps=GpsModel(mode="NO_FIX", lat=None, lon=None, alt_m=None, hdop=None, sats=0, ts=ts),
        imu=ImuModel(roll_deg=0.0, pitch_deg=0.0, yaw_deg=0.0, temp_c=None, ts=ts),
        axes={
            "AZ": AxisState(target_deg=45.0, actual_deg=44.8, error_deg=0.2, rate_dps=0.1, ts=ts),
            "EL": AxisState(target_deg=30.0, actual_deg=29.9, error_deg=0.1, rate_dps=0.05, ts=ts),
            "CL": AxisState(target_deg=0.0,  actual_deg=0.1,  error_deg=-0.1, rate_dps=0.0, ts=ts),
        },
        servos={
            "AZ": ServoState(axis="AZ", mode="TRACK", current_ma=850, temp_c=38.0, error_code=None, ts=ts),
            "EL": ServoState(axis="EL", mode="TRACK", current_ma=720, temp_c=36.0, error_code=None, ts=ts),
            "CL": ServoState(axis="CL", mode="HOLD",  current_ma=400, temp_c=32.0, error_code=None, ts=ts),
        },
        limits={
            "AZ": LimitState(in1=False, in2=False, ts=ts),
            "EL": LimitState(in1=False, in2=None,  ts=ts),
            "CL": LimitState(in1=False, in2=None,  ts=ts),
        },
        system=SystemModel(cpu=25.0, gpu=0.0, mem=45.0, disk=60.0, temps={"cpu": 45.0}, ts=ts),
        selected_satellite=None,
    )

# ---------- Endpoints ----------

@router.get("/current", response_model=TelemetrySnapshot)
async def get_current_telemetry(request: Request):
    """Get the most recent telemetry snapshot."""
    # late import is OK if you truly need to avoid cycles
    from ...services.telemetry_service import TelemetryService  # noqa: F401
    svc = getattr(request.app.state, "telemetry_service", None)
    if not svc or not getattr(svc, "current_telemetry", None):
        return _mock_snapshot()
    # If svc.current_telemetry is a Pydantic model:
    model = svc.current_telemetry
    try:
        return model.model_dump()  # FastAPI will re-validate to TelemetrySnapshot
    except AttributeError:
        # not a pydantic model; assume dict-like
        return model

@router.get("/health", response_model=HealthStatus)
async def get_health_status(request: Request):
    """Get system health status (INAV-style)."""
    from ...services.telemetry_service import TelemetryService  # noqa: F401
    svc = getattr(request.app.state, "telemetry_service", None)
    if not svc:
        ts = "2024-01-01T00:00:00Z"
        return HealthStatus(
            link={"status":"ERROR","message":"Service not running","last_update":ts},
            gps={"status":"OFF","message":"No GPS","last_update":ts},
            imu={"status":"OFF","message":"No IMU","last_update":ts},
            servos={"status":"OFF","message":"No servos","last_update":ts},
            limits={"status":"OFF","message":"Unknown","last_update":ts},
            tle={"status":"OFF","message":"No TLE data","last_update":ts},
            time={"status":"OFF","message":"Unknown","last_update":ts},
            system={"status":"OFF","message":"Unknown","last_update":ts},
            sim={"status":"OFF","message":"Unknown","last_update":ts},
        )
    model = svc.get_health_status()
    try:
        return model.model_dump()
    except AttributeError:
        return model

@router.get("/history", response_model=HistoryResponse)
async def get_telemetry_history(
    hours: int = Query(24, ge=1, le=168, description="Hours of history to retrieve"),
    resolution: HistoryResolution = Query(HistoryResolution.m1, description="Data resolution"),
):
    """Get historical telemetry data (stub)."""
    end_dt = datetime(2024, 1, 2, 0, 0, 0, tzinfo=timezone.utc)  # fixed to be valid
    start_dt = end_dt - timedelta(hours=hours)
    # TODO: replace with DB-backed query & downsample by 'resolution'
    return HistoryResponse(
        start_time=start_dt.isoformat().replace("+00:00", "Z"),
        end_time=end_dt.isoformat().replace("+00:00", "Z"),
        resolution=resolution,
        data_points=1440 if resolution == HistoryResolution.m1 else 24,
        data=[
            HistoryPoint(
                timestamp=start_dt.isoformat().replace("+00:00", "Z"),
                gps_lat=37.7749,
                gps_lon=-122.4194,
                az_deg=45.0,
                el_deg=30.0,
                cpu_percent=25.0,
            )
        ],
    )
