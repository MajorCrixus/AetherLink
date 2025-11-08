"""
Telemetry data models and types
Implements the data contracts specified in the requirements
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

# Core data types
AngleDeg = float  # -360..+360
DegreesPerSec = float

class GPSFix(BaseModel):
    mode: Literal['NO_FIX', '2D', '3D']
    hdop: Optional[float] = None
    pdop: Optional[float] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    alt_m: Optional[float] = None
    speed_mps: Optional[float] = None
    course_deg: Optional[float] = None
    sats: Optional[int] = None
    ts: str  # ISO-8601 UTC

class IMU(BaseModel):
    roll_deg: float
    pitch_deg: float
    yaw_deg: float
    temp_c: Optional[float] = None
    # Orientation data (from WT901C tilt-compensated heading)
    heading_mag_deg: Optional[float] = None  # Magnetic heading 0-360° (with offset applied)
    heading_true_deg: Optional[float] = None  # True heading 0-360° (mag + declination)
    cross_level_deg: Optional[float] = None  # Roll about boresight
    elevation_deg: Optional[float] = None  # Pitch about right axis
    declination_deg: Optional[float] = None
    heading_offset_deg: Optional[float] = None
    ts: str

class AxisState(BaseModel):
    target_deg: AngleDeg
    actual_deg: AngleDeg
    error_deg: AngleDeg
    rate_dps: Optional[DegreesPerSec] = None
    ts: str

class ServoState(BaseModel):
    axis: Literal['AZ', 'EL', 'CL']  # Azimuth, Elevation, Cross-level
    mode: Literal['IDLE', 'HOLD', 'TRACK', 'CALIB']
    current_ma: Optional[int] = None
    temp_c: Optional[float] = None
    error_code: Optional[str] = None
    ts: str

class LimitState(BaseModel):
    in1: bool
    in2: Optional[bool] = None
    ts: str

class SystemState(BaseModel):
    cpu: float  # CPU usage percentage
    gpu: float  # GPU usage percentage
    mem: float  # Memory usage percentage
    disk: float  # Disk usage percentage
    temps: Dict[str, Optional[float]]  # Temperature readings
    ts: str

class SatelliteSummary(BaseModel):
    norad_id: int
    name: str
    orbit: Literal['LEO', 'MEO', 'HEO', 'GEO']
    next_pass: Optional[Dict[str, Any]] = None
    el_now_deg: Optional[float] = None
    band: Optional[List[str]] = None

class TelemetryData(BaseModel):
    """Complete telemetry data packet"""
    timestamp: str  # ISO-8601 UTC
    gps: GPSFix
    imu: IMU
    axes: Dict[str, AxisState]  # 'AZ', 'EL', 'CL'
    servos: Dict[str, ServoState]
    limits: Dict[str, LimitState]
    system: SystemState
    selected_satellite: Optional[SatelliteSummary] = None

class SatelliteData(BaseModel):
    """Satellite tracking data"""
    list: List[SatelliteSummary]
    filters: Dict[str, Any]
    last_updated: str

class LogMessage(BaseModel):
    level: Literal['DEBUG', 'INFO', 'WARN', 'ERROR', 'ALERT']
    source: str
    message: str
    ts: str

class EventMessage(BaseModel):
    type: str
    severity: Literal['INFO', 'WARN', 'ERROR', 'ALERT']
    payload: Dict[str, Any]
    ts: str

class SimulationState(BaseModel):
    """Demo mode simulation state"""
    enabled: bool
    profile: Optional[str] = None

# Health/connectivity states (INAV-style)
class HealthState(BaseModel):
    status: Literal['OK', 'WARN', 'ERROR', 'OFF', 'INIT', 'SIM']
    message: Optional[str] = None
    last_update: str

class HealthStatus(BaseModel):
    """System health overview"""
    link: HealthState  # FE ↔ BE WebSocket
    gps: HealthState
    imu: HealthState
    servos: HealthState
    limits: HealthState
    tle: HealthState
    time: HealthState
    system: HealthState
    sim: HealthState  # Demo mode active

# WebSocket channel data
class WebSocketMessage(BaseModel):
    """Base WebSocket message"""
    channel: str
    data: Dict[str, Any]
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Configuration models
class AxisConfig(BaseModel):
    min_deg: float
    max_deg: float
    zero_offset: float = 0.0
    max_rate_dps: float = 45.0

class ServoConfig(BaseModel):
    addr: int
    baud: int = 38400
    mode: str = "HOLD"

class SystemConfig(BaseModel):
    version: int = 1
    units: Dict[str, str] = {"angles": "deg", "distance": "m"}
    network: Dict[str, Any] = {
        "bind": "0.0.0.0",
        "port": 9000,
        "auth": {"enabled": False}
    }
    demo: Dict[str, Any] = {"enabled": False, "profile": "lab"}
    axes: Dict[str, AxisConfig]
    servos: Dict[str, ServoConfig]
    limits: Dict[str, Any] = {
        "in1_active_low": True,
        "in2_active_low": True,
        "debounce_ms": 5
    }
    ephemeris: Dict[str, Any] = {
        "source": "space-track",
        "credentials_name": "stub",
        "stale_after_hours": 12
    }
    api: Dict[str, Any] = {"rate_limits": {"move": 5}}
    logging: Dict[str, Any] = {"level": "INFO", "persist": True}

# API request/response models
class MoveCommand(BaseModel):
    target_deg: float
    speed_dps: Optional[float] = None

class ModeCommand(BaseModel):
    mode: Literal['IDLE', 'HOLD', 'TRACK', 'CALIB']

class CLICommand(BaseModel):
    cmd: str
    args: List[str] = []

class CLIResponse(BaseModel):
    stdout: str
    stderr: str
    code: int

class DemoModeConfig(BaseModel):
    enabled: bool
    profile: Optional[str] = None