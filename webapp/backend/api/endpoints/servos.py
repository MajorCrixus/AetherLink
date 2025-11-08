"""
Servo control endpoints with safety systems and console commands
"""

import asyncio
import httpx
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from dataclasses import dataclass

from ...core.config import settings
from ...services.telemetry_service import TelemetryService
from ...services.satellite_tracking import calculate_azimuth_elevation
from ...core.database import save_servo_command, get_servo_command_history

router = APIRouter()

# Global telemetry service reference (injected at startup)
_telemetry_service: TelemetryService = None

# Servo address mapping
SERVO_ADDRESSES = {
    "az": 0x01,
    "el": 0x02,
    "cl": 0x03
}

def set_telemetry_service(service: TelemetryService):
    """Set the global telemetry service reference"""
    global _telemetry_service
    _telemetry_service = service

def get_telemetry_service() -> TelemetryService:
    """Dependency to get telemetry service"""
    if _telemetry_service is None:
        raise HTTPException(status_code=503, detail="Telemetry service not initialized")
    return _telemetry_service

class ServoMoveRequest(BaseModel):
    target_deg: float = Field(..., description="Target angle in degrees")
    speed_rpm: int = Field(default=20, ge=1, le=100, description="Speed in RPM")

class ServoModeRequest(BaseModel):
    mode: str = Field(..., description="Servo mode: IDLE, HOLD, TRACK, CALIB")

class SatelliteAcquireRequest(BaseModel):
    norad_id: int = Field(..., description="NORAD catalog ID of satellite to acquire")

# Safety limits for each axis
AXIS_LIMITS = {
    "az": (settings.AZ_MIN, settings.AZ_MAX),
    "el": (settings.EL_MIN, settings.EL_MAX),
    "cl": (settings.CL_MIN, settings.CL_MAX)
}

def validate_axis(axis: str) -> str:
    """Validate and normalize axis name"""
    axis = axis.lower()
    if axis not in AXIS_LIMITS:
        raise HTTPException(status_code=400, detail=f"Invalid axis '{axis}'. Must be one of: az, el, cl")
    return axis

def validate_target_angle(axis: str, target_deg: float):
    """Validate target angle is within safety limits"""
    min_deg, max_deg = AXIS_LIMITS[axis]
    if not (min_deg <= target_deg <= max_deg):
        raise HTTPException(
            status_code=400,
            detail=f"Target angle {target_deg}° outside safety limits for {axis.upper()} ({min_deg}° to {max_deg}°)"
        )

@router.post("/{axis}/move")
async def move_servo(
    axis: str,
    request: ServoMoveRequest,
    background_tasks: BackgroundTasks,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Move servo to target position with safety checks"""
    axis = validate_axis(axis)
    validate_target_angle(axis, request.target_deg)

    # Get the appropriate manager (hardware or simulator)
    if telemetry_service.demo_mode:
        # Update simulator targets
        if axis == "az":
            telemetry_service.demo_simulator.az_target = request.target_deg
        elif axis == "el":
            telemetry_service.demo_simulator.el_target = request.target_deg
        elif axis == "cl":
            telemetry_service.demo_simulator.cl_target = request.target_deg
    else:
        # Command real hardware
        success = await telemetry_service.hardware_manager.move_servo(
            axis.upper(),
            request.target_deg,
            request.speed_rpm
        )
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to move {axis.upper()}")

    return {
        "status": "success",
        "axis": axis.upper(),
        "target_deg": request.target_deg,
        "speed_rpm": request.speed_rpm,
        "message": f"Moving {axis.upper()} to {request.target_deg}° at {request.speed_rpm} RPM",
        "mode": "simulation" if telemetry_service.demo_mode else "hardware"
    }

@router.post("/{axis}/mode")
async def set_servo_mode(axis: str, request: ServoModeRequest) -> Dict[str, Any]:
    """Set servo operating mode"""
    axis = validate_axis(axis)

    valid_modes = ["IDLE", "HOLD", "TRACK", "CALIB"]
    if request.mode not in valid_modes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{request.mode}'. Must be one of: {', '.join(valid_modes)}"
        )

    # TODO: Implement actual mode setting via hardware manager

    return {
        "status": "success",
        "axis": axis.upper(),
        "mode": request.mode,
        "message": f"Set {axis.upper()} mode to {request.mode}"
    }

@router.post("/{axis}/stop")
async def stop_servo(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Emergency stop specific servo"""
    axis = validate_axis(axis)

    if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
        try:
            servo_bus = telemetry_service.hardware_manager.servo_bus
            addr = {"az": 0x01, "el": 0x02, "cl": 0x03}[axis]

            # Send emergency stop command (0xF7)
            await asyncio.to_thread(servo_bus.emergency_stop, addr)

            return {
                "status": "success",
                "axis": axis.upper(),
                "message": f"Emergency stop sent to {axis.upper()}"
            }
        except Exception as e:
            return {
                "status": "error",
                "axis": axis.upper(),
                "message": f"Failed to stop servo: {str(e)}"
            }
    else:
        return {
            "status": "error",
            "axis": axis.upper(),
            "message": "Hardware not available"
        }

@router.post("/stop-all")
async def stop_all_servos(
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Emergency stop all servos"""

    if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
        try:
            servo_bus = telemetry_service.hardware_manager.servo_bus

            # Send emergency stop to all three servos
            for addr in [0x01, 0x02, 0x03]:
                await asyncio.to_thread(servo_bus.emergency_stop, addr)

            return {
                "status": "success",
                "message": "Emergency stop sent to all servos"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to stop servos: {str(e)}"
            }
    else:
        return {
            "status": "error",
            "message": "Hardware not available"
        }

@router.post("/acquire-satellite")
async def acquire_satellite(
    request: SatelliteAcquireRequest,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """
    Acquire satellite by calculating azimuth and elevation from TLE and GPS coordinates

    This endpoint:
    1. Fetches satellite TLE from satcat-backend
    2. Gets current GPS coordinates from telemetry
    3. Calculates azimuth and elevation
    4. Commands servos to point at satellite
    """
    try:
        # Get GPS coordinates from telemetry
        gps_data = telemetry_service.get_current_state().get("gps", {})
        lat = gps_data.get("latitude")
        lon = gps_data.get("longitude")
        alt = gps_data.get("altitude", 0.0)

        if lat is None or lon is None:
            raise HTTPException(
                status_code=400,
                detail="GPS coordinates not available. Ensure GPS has a valid fix."
            )

        # Fetch TLE from satcat-backend
        satcat_url = f"http://localhost:9001/api/satellites/{request.norad_id}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(satcat_url)
            if response.status_code == 404:
                raise HTTPException(
                    status_code=404,
                    detail=f"Satellite {request.norad_id} not found in catalog"
                )
            elif response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to fetch satellite data from satcat-backend: {response.status_code}"
                )

            sat_data = response.json()

        # Extract TLE
        tle = sat_data.get("tle")
        if not tle or not tle.get("line1") or not tle.get("line2"):
            raise HTTPException(
                status_code=400,
                detail=f"Satellite {request.norad_id} has no TLE data available"
            )

        # Calculate azimuth and elevation
        azimuth, elevation = calculate_azimuth_elevation(
            norad_id=request.norad_id,
            tle_line1=tle["line1"],
            tle_line2=tle["line2"],
            observer_lat=lat,
            observer_lon=lon,
            observer_alt_m=alt,
            satellite_name=sat_data.get("name", "")
        )

        # Check if satellite is above horizon
        if elevation < 0:
            return {
                "status": "warning",
                "message": f"Satellite is below horizon (elevation: {elevation:.2f}°)",
                "satellite_name": sat_data.get("name"),
                "azimuth_deg": azimuth,
                "elevation_deg": elevation,
                "commanded": False
            }

        # Validate angles are within servo limits
        validate_target_angle("az", azimuth)
        validate_target_angle("el", elevation)

        # Command servos
        if telemetry_service.demo_mode:
            # Update simulator
            telemetry_service.demo_simulator.az_target = azimuth
            telemetry_service.demo_simulator.el_target = elevation
        else:
            # Command real hardware
            az_success = await telemetry_service.hardware_manager.move_servo(
                "AZ", azimuth, speed_rpm=20
            )
            el_success = await telemetry_service.hardware_manager.move_servo(
                "EL", elevation, speed_rpm=20
            )

            if not (az_success and el_success):
                raise HTTPException(
                    status_code=500,
                    detail="Failed to command servos"
                )

        return {
            "status": "success",
            "message": f"Acquiring satellite {sat_data.get('name')}",
            "satellite_name": sat_data.get("name"),
            "norad_id": request.norad_id,
            "azimuth_deg": azimuth,
            "elevation_deg": elevation,
            "observer": {
                "latitude": lat,
                "longitude": lon,
                "altitude_m": alt
            },
            "commanded": True
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Satellite acquisition failed: {str(e)}"
        )

@router.get("/{axis}/status")
async def get_servo_status(axis: str) -> Dict[str, Any]:
    """Get current servo status"""
    axis = validate_axis(axis)

    # TODO: Get actual status from hardware manager

    return {
        "axis": axis.upper(),
        "mode": "HOLD",
        "current_deg": 0.0,
        "target_deg": 0.0,
        "error_deg": 0.0,
        "current_ma": 800,
        "temp_c": 35.0,
        "status": "OK"
    }

@router.post("/{axis}/home")
async def home_servo(axis: str) -> Dict[str, Any]:
    """Run homing routine for servo"""
    axis = validate_axis(axis)

    # TODO: Implement homing via hardware manager

    return {
        "status": "success",
        "axis": axis.upper(),
        "message": f"Starting homing routine for {axis.upper()}"
    }

@router.post("/{axis}/calibrate")
async def calibrate_servo(axis: str) -> Dict[str, Any]:
    """Start calibration routine for servo"""
    axis = validate_axis(axis)

    # TODO: Implement calibration via hardware manager

    return {
        "status": "success",
        "axis": axis.upper(),
        "message": f"Starting calibration for {axis.upper()}"
    }

# ========== CONSOLE COMMANDS ==========

class MoveAbsoluteRequest(BaseModel):
    target_deg: float = Field(..., description="Target angle in degrees")
    speed_pct: int = Field(default=10, ge=1, le=100, description="Speed percentage")

class MoveRelativeRequest(BaseModel):
    delta_deg: float = Field(..., description="Relative movement in degrees")
    speed_pct: int = Field(default=10, ge=1, le=100, description="Speed percentage")

class SpeedRequest(BaseModel):
    speed_pct: int = Field(..., ge=10, le=100, description="Speed percentage (10-100)")

class HomeRequest(BaseModel):
    method: str = Field(default="limit", description="Homing method: 'limit' or 'stall'")
    # Limit-based homing params
    direction: Optional[str] = Field(default="cw", description="Homing direction: 'cw' or 'ccw'")
    speed_rpm: Optional[int] = Field(default=200, ge=1, le=3000, description="Homing speed in RPM")
    trigger: Optional[str] = Field(default="low", description="Limit trigger: 'low' or 'high'")
    end_limit: Optional[bool] = Field(default=True, description="Enable end limit protection")
    # Stall-based homing params
    current_ma: Optional[int] = Field(default=400, description="Homing current in mA")
    backoff_deg: Optional[float] = Field(default=180.0, description="Backoff distance in degrees")

class ProtectRequest(BaseModel):
    enabled: bool = Field(..., description="Enable or disable protection")

class RawCommandRequest(BaseModel):
    hex_data: str = Field(..., description="Raw hex command (without CRC)")

@router.get("/console/{axis}/full-status")
async def get_full_servo_status(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Get comprehensive servo status for console display"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    # Check if we're receiving telemetry data for this axis
    telemetry = telemetry_service.get_current_telemetry()
    is_online = False
    current_deg = 0.0
    target_deg = 0.0

    if telemetry and telemetry.axes:
        axis_data = telemetry.axes.get(axis.upper())
        if axis_data:
            is_online = True
            current_deg = axis_data.actual_deg
            target_deg = axis_data.target_deg if hasattr(axis_data, 'target_deg') else current_deg

    if telemetry_service.demo_mode:
        # Demo mode - return simulated status
        return {
            "status": "success",
            "axis": axis.upper(),
            "mode": "demo",
            "data": {
                "address": addr,
                "online": is_online,
                "status_code": 1,  # STOP
                "status_text": "STOP",
                "current_deg": current_deg,
                "target_deg": target_deg,
                "error_deg": 0.0,
                "speed_rpm": 0,
                "current_ma": 800,
                "temp_c": 35.0,
                "encoder_value": 0,
                "protect_flag": 1,
                "io": {"IN1": False, "IN2": False, "OUT1": False, "OUT2": False},
                "errors": [],
                "raw_status": "FB 01 F1 01 XX"
            }
        }

    # Real hardware mode
    try:
        # Check if hardware manager can communicate with the servo
        if telemetry_service.hardware_manager:
            # If we have telemetry data for this axis, consider it online
            return {
                "status": "success",
                "axis": axis.upper(),
                "mode": "hardware",
                "data": {
                    "address": addr,
                    "online": is_online,
                    "current_deg": current_deg,
                    "target_deg": target_deg,
                    "message": "Connected to hardware" if is_online else "No telemetry data"
                }
            }
        else:
            return {
                "status": "success",
                "axis": axis.upper(),
                "mode": "hardware",
                "data": {
                    "address": addr,
                    "online": False,
                    "message": "Hardware manager not initialized"
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/console/{axis}/move-absolute")
async def console_move_absolute(
    axis: str,
    request: MoveAbsoluteRequest,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Move servo to absolute position"""
    axis = validate_axis(axis)
    validate_target_angle(axis, request.target_deg)

    speed_rpm = int(request.speed_pct * 30 / 100)  # Convert % to RPM (max ~30 RPM)

    if telemetry_service.demo_mode:
        # Update demo simulator
        if axis == "az":
            telemetry_service.demo_simulator.az_target = request.target_deg
        elif axis == "el":
            telemetry_service.demo_simulator.el_target = request.target_deg
        elif axis == "cl":
            telemetry_service.demo_simulator.cl_target = request.target_deg
    else:
        # Command hardware
        success = await telemetry_service.hardware_manager.move_servo(
            axis.upper(), request.target_deg, speed_rpm
        )
        if not success:
            return {"status": "error", "message": f"Failed to move {axis.upper()}"}

    return {
        "status": "success",
        "axis": axis.upper(),
        "command": "move_absolute",
        "request": {"target_deg": request.target_deg, "speed_pct": request.speed_pct},
        "response": {"success": True, "target_deg": request.target_deg, "speed_rpm": speed_rpm}
    }

@router.post("/console/{axis}/move-relative")
async def console_move_relative(
    axis: str,
    request: MoveRelativeRequest,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Move servo relative to current position"""
    axis = validate_axis(axis)

    # Get current position from telemetry
    telemetry = telemetry_service.get_current_telemetry()
    current_deg = 0.0

    if telemetry and telemetry.axes:
        axis_data = telemetry.axes.get(axis.upper())
        if axis_data:
            current_deg = axis_data.actual_deg

    target_deg = current_deg + request.delta_deg
    validate_target_angle(axis, target_deg)

    speed_rpm = int(request.speed_pct * 30 / 100)

    if telemetry_service.demo_mode:
        if axis == "az":
            telemetry_service.demo_simulator.az_target = target_deg
        elif axis == "el":
            telemetry_service.demo_simulator.el_target = target_deg
        elif axis == "cl":
            telemetry_service.demo_simulator.cl_target = target_deg
    else:
        success = await telemetry_service.hardware_manager.move_servo(
            axis.upper(), target_deg, speed_rpm
        )
        if not success:
            return {"status": "error", "message": f"Failed to move {axis.upper()}"}

    return {
        "status": "success",
        "axis": axis.upper(),
        "command": "move_relative",
        "request": {"delta_deg": request.delta_deg, "speed_pct": request.speed_pct},
        "response": {"success": True, "current_deg": current_deg, "target_deg": target_deg, "speed_rpm": speed_rpm}
    }

@router.post("/console/{axis}/stop")
async def console_stop(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Emergency stop servo motion (function 0xF7)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> F7 <crc>)
            frame = bytes([0xFA, addr, 0xF7])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                result = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.emergency_stop,
                    addr
                )

            # Response is FB <addr> F7 <status> <crc>
            resp_frame = bytes([0xFB, addr, 0xF7, result])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "stop",
                "request": {"hex_sent": sent_hex},
                "response": {
                    "success": result == 1,
                    "result": result,
                    "hex_received": resp_hex,
                    "message": "Emergency stop executed"
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stop failed: {str(e)}")

@router.post("/console/{axis}/jog")
async def console_jog(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Continuous jog motion (function 0xF6)"""
    axis = validate_axis(axis)

    direction = request.get("direction", "cw")  # "cw" or "ccw"
    speed_pct = request.get("speed_pct", 10)
    acceleration = request.get("acceleration", 100)

    # Convert speed percentage to RPM (max 3000 RPM)
    speed_rpm = int(speed_pct * 3000 / 100)
    speed_rpm = max(1, min(3000, speed_rpm))  # Clamp to valid range

    if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
        try:
            servo_bus = telemetry_service.hardware_manager.servo_bus
            addr = SERVO_ADDRESSES[axis]

            # Pack speed and direction
            dir_ccw = (direction.lower() == "ccw")
            dir_byte = 1 if dir_ccw else 0
            speed_high = (speed_rpm >> 8) & 0xFF
            speed_low = speed_rpm & 0xFF

            # Build hex frame for logging (FA <addr> F6 <dir> <speed_h> <speed_l> <acc> <crc>)
            frame = bytes([0xFA, addr, 0xF6, dir_byte, speed_high, speed_low, acceleration])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                status = await asyncio.to_thread(
                    servo_bus.run_speed_mode,
                    addr,
                    dir_ccw,
                    speed_rpm,
                    acceleration
                )

            # Response is FB <addr> F6 <status> <crc>
            resp_frame = bytes([0xFB, addr, 0xF6, status])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "jog",
                "request": {"direction": direction, "speed_pct": speed_pct, "speed_rpm": speed_rpm, "hex_sent": sent_hex},
                "response": {
                    "success": True,
                    "status_byte": status,
                    "message": f"Jogging {direction.upper()} at {speed_rpm} RPM",
                    "hex_received": resp_hex
                }
            }
        except Exception as e:
            return {
                "status": "error",
                "axis": axis.upper(),
                "message": f"Failed to jog: {str(e)}"
            }
    else:
        return {
            "status": "error",
            "axis": axis.upper(),
            "message": "Hardware not available"
        }

@router.post("/console/{axis}/set-speed")
async def console_set_speed(axis: str, request: SpeedRequest) -> Dict[str, Any]:
    """Set servo speed percentage"""
    axis = validate_axis(axis)

    return {
        "status": "success",
        "axis": axis.upper(),
        "command": "set_speed",
        "request": {"speed_pct": request.speed_pct},
        "response": {"success": True, "speed_pct": request.speed_pct}
    }

@router.post("/console/{axis}/home")
async def console_home(
    axis: str,
    request: HomeRequest,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Run homing routine with parameter configuration"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    # Validate homing method for axis
    if axis == "az" and request.method != "limit":
        raise HTTPException(status_code=400, detail="Azimuth must use 'limit' homing method")
    if axis in ["el", "cl"] and request.method != "stall":
        raise HTTPException(status_code=400, detail="Elevation/Cross-level must use 'stall' homing method")

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            servo_bus = telemetry_service.hardware_manager.servo_bus
            hex_log = []

            # CRITICAL: Acquire bus lock for entire homing sequence
            async with telemetry_service.hardware_manager._bus_lock:
                if request.method == "limit":
                    # Configure limit-based homing parameters (function 0x90)
                    from hardware.servo_motors.code_library.mks_servo57d_lib import HomeParams

                    hm_trig = 1 if request.trigger == "high" else 0
                    hm_dir = 1 if request.direction == "ccw" else 0
                    hm_speed = request.speed_rpm or 200
                    end_limit = 1 if request.end_limit else 0

                    hm_params = HomeParams(
                        hm_trig=hm_trig,
                        hm_dir=hm_dir,
                        hm_speed=hm_speed,
                        end_limit=end_limit
                    )

                    # Build hex frame for set_home_params (FA <addr> 90 <trig> <dir> <speed_h> <speed_l> <end_limit> <crc>)
                    speed_high = (hm_speed >> 8) & 0xFF
                    speed_low = hm_speed & 0xFF
                    config_frame = bytes([0xFA, addr, 0x90, hm_trig, hm_dir, speed_high, speed_low, end_limit])
                    config_crc = sum(config_frame) & 0xFF
                    config_hex = " ".join(f"{b:02X}" for b in (config_frame + bytes([config_crc])))

                    config_result = await asyncio.to_thread(servo_bus.set_home_params, addr, hm_params)

                    config_resp = bytes([0xFB, addr, 0x90, config_result])
                    config_resp_crc = sum(config_resp) & 0xFF
                    config_resp_hex = " ".join(f"{b:02X}" for b in (config_resp + bytes([config_resp_crc])))

                    hex_log.append(f"Config(0x90): Sent={config_hex}, Recv={config_resp_hex}")

                elif request.method == "stall":
                    # Configure stall-based homing (function 0x94)
                    hm_ma = request.current_ma or 400
                    backoff_ticks = int((request.backoff_deg or 180.0) * 16384 / 360.0)  # Convert deg to ticks

                    # Build hex frame for set_nolimit_home (FA <addr> 94 <ticks3> <ticks2> <ticks1> <ticks0> <mode> <ma_h> <ma_l> <crc>)
                    ticks_bytes = backoff_ticks.to_bytes(4, byteorder='big', signed=False)
                    ma_bytes = hm_ma.to_bytes(2, byteorder='big', signed=False)
                    config_frame = bytes([0xFA, addr, 0x94]) + ticks_bytes + bytes([0x00]) + ma_bytes
                    config_crc = sum(config_frame) & 0xFF
                    config_hex = " ".join(f"{b:02X}" for b in (config_frame + bytes([config_crc])))

                    config_result = await asyncio.to_thread(servo_bus.set_nolimit_home, addr, backoff_ticks, 0, hm_ma)

                    config_resp = bytes([0xFB, addr, 0x94, config_result])
                    config_resp_crc = sum(config_resp) & 0xFF
                    config_resp_hex = " ".join(f"{b:02X}" for b in (config_resp + bytes([config_resp_crc])))

                    hex_log.append(f"Config(0x94): Sent={config_hex}, Recv={config_resp_hex}")

                # Execute homing (function 0x91)
                home_frame = bytes([0xFA, addr, 0x91])
                home_crc = sum(home_frame) & 0xFF
                home_hex = " ".join(f"{b:02X}" for b in (home_frame + bytes([home_crc])))

                result = await asyncio.to_thread(servo_bus.go_home, addr)

                # Response is FB <addr> 91 <status> <crc>
                # Status: 0=fail, 1=start, 2=success
                home_resp = bytes([0xFB, addr, 0x91, result])
                home_resp_crc = sum(home_resp) & 0xFF
                home_resp_hex = " ".join(f"{b:02X}" for b in (home_resp + bytes([home_resp_crc])))

            hex_log.append(f"Execute(0x91): Sent={home_hex}, Recv={home_resp_hex}")
            status_msg = {0: "failed", 1: "started", 2: "success"}.get(result, "unknown")

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "home",
                "request": {
                    "method": request.method,
                    "direction": request.direction,
                    "speed_rpm": request.speed_rpm,
                    "trigger": request.trigger,
                    "end_limit": request.end_limit,
                    "current_ma": request.current_ma,
                    "backoff_deg": request.backoff_deg,
                    "hex_sent": home_hex
                },
                "response": {
                    "success": result != 0,
                    "result": result,
                    "hex_received": home_resp_hex,
                    "hex_log": " | ".join(hex_log),
                    "message": f"Homing {status_msg}"
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "home",
            "message": str(e)
        }

@router.post("/console/{axis}/set-zero")
async def console_set_zero(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set current position as zero (function 0x92)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 92 <crc>)
            frame = bytes([0xFA, addr, 0x92])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                result = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.set_axis_zero,
                    addr
                )

            # Response is FB <addr> 92 <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x92, result])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_zero",
                "request": {"hex_sent": sent_hex},
                "response": {
                    "success": result == 1,
                    "result": result,
                    "hex_received": resp_hex,
                    "message": "Current position set as zero"
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Set zero failed: {str(e)}")

@router.post("/console/{axis}/protect")
async def console_protect(
    axis: str,
    request: ProtectRequest,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Enable or disable stall protection (function 0x88)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 88 <enabled> <crc>)
            data_byte = 1 if request.enabled else 0
            frame = bytes([0xFA, addr, 0x88, data_byte])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                result = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.set_stall_protect,
                    addr,
                    request.enabled
                )

            # Response is FB <addr> 88 <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x88, result])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "protect",
                "request": {"enabled": request.enabled, "hex_sent": sent_hex},
                "response": {
                    "success": result == 1,
                    "result": result,
                    "enabled": request.enabled,
                    "hex_received": resp_hex,
                    "message": f"Stall protection {'enabled' if request.enabled else 'disabled'}"
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Set protection failed: {str(e)}")

@router.get("/console/{axis}/io")
async def console_read_io(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Read inputs/outputs (function 0x34)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 34 <crc>)
            frame = bytes([0xFA, addr, 0x34])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                io_flags = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.read_io,
                    addr
                )

            # Parse IOFlags (IntFlag with bits: IN1, IN2, OUT1, OUT2)
            io_value = int(io_flags)
            io_dict = {
                "IN1": bool(io_value & 0x01),
                "IN2": bool(io_value & 0x02),
                "OUT1": bool(io_value & 0x04),
                "OUT2": bool(io_value & 0x08)
            }

            # Response is FB <addr> 34 <io_byte> <crc>
            resp_frame = bytes([0xFB, addr, 0x34, io_value])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "read_io",
                "request": {"hex_sent": sent_hex},
                "response": {
                    "success": True,
                    "io": io_dict,
                    "raw_value": io_value,
                    "hex_received": resp_hex
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Read IO failed: {str(e)}")

@router.post("/console/{axis}/raw")
async def console_raw_command(
    axis: str,
    request: RawCommandRequest,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Send raw UART command with automatic CRC calculation"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    try:
        # Parse hex string and remove spaces/0x prefix
        hex_clean = request.hex_data.replace(" ", "").replace("0x", "").upper()

        # Convert to bytes
        if len(hex_clean) % 2 != 0:
            raise ValueError("Hex string must have even length")

        cmd_bytes = bytes.fromhex(hex_clean)

        # Calculate CRC (checksum-8: sum of all bytes & 0xFF)
        crc = sum(cmd_bytes) & 0xFF
        frame_with_crc = cmd_bytes + bytes([crc])

        # Format hex strings for display
        sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)
        sent_hex_parts = " ".join(f"{b:02X}" for b in cmd_bytes)

        # Parse the command frame
        if len(cmd_bytes) >= 3:
            header = cmd_bytes[0]
            address = cmd_bytes[1]
            function = cmd_bytes[2]
            data_bytes = cmd_bytes[3:] if len(cmd_bytes) > 3 else b""

            # Function code descriptions (comprehensive v1.0.6 catalog)
            function_names = {
                # Read commands (0x30-0x4x)
                0x30: "Read Encoder Value (Carry)",
                0x31: "Read Encoder Addition",
                0x32: "Read Speed (RPM)",
                0x33: "Read Pulse Count",
                0x34: "Read I/O Bitmap",
                0x35: "Read Raw Addition",
                0x36: "Write Outputs",
                0x39: "Read Angle Error",
                0x3A: "Read EN Status",
                0x3B: "Read Zero Status",
                0x3D: "Release Protect",
                0x3E: "Read Protect Status",
                0x3F: "Factory Reset",
                0x40: "Read Version",
                0x41: "Restart Device",
                0x46: "Write All Params",
                0x47: "Read All Params",
                0x48: "Status Bundle",
                # Configuration commands (0x82-0x9E)
                0x82: "Set Mode",
                0x83: "Set Work Current",
                0x84: "Set Microstep",
                0x85: "Set EN Active",
                0x86: "Set Direction",
                0x87: "Set Auto-Sleep",
                0x88: "Set Stall Protect",
                0x89: "Set Microstep Interp",
                0x8A: "Set Baud Rate",
                0x8B: "Set Slave Address",
                0x8C: "Set Respond/Active",
                0x8D: "Set Group Address",
                0x8E: "Set Modbus Enable",
                0x8F: "Set Key Lock",
                0x90: "Set Home Params",
                0x91: "Execute Home",
                0x92: "Set Zero Here",
                0x93: "Set Home Direction",
                0x94: "Set No-Limit Home",
                0x9A: "Zero Mode / Single Turn Home",
                0x9B: "Set Hold Current",
                0x9C: "Set EN/Zero/Protect",
                0x9E: "Set Limit Remap",
                0x9F: "Set Limit Polarity",
                0xA0: "Set Limit Function",
                0xA1: "Set PID Kp",
                0xA2: "Set PID Ki",
                0xA3: "Set PID Kd",
                0xA4: "Set Start Accel",
                0xA5: "Set Stop Accel",
                # Motion commands (0xF1-0xFE)
                0xF1: "Query Motor Status",
                0xF4: "Move Absolute (Axis)",
                0xF5: "Move Relative (Axis)",
                0xF6: "Speed Mode",
                0xF7: "Emergency Stop",
                0xFD: "Move Relative (Pulses)",
                0xFE: "Move Absolute (Pulses)",
                0xFF: "Power-on Autorun",
            }

            function_name = function_names.get(function, f"Unknown (0x{function:02X})")

            request_parsed = {
                "header": f"0x{header:02X}",
                "address": f"0x{address:02X}",
                "function": f"0x{function:02X}",
                "function_name": function_name,
                "data": data_bytes.hex().upper() if data_bytes else "None",
                "crc": f"0x{crc:02X}"
            }
        else:
            request_parsed = {"error": "Frame too short (need at least 3 bytes: header, address, function)"}

        # Send to hardware if available
        response_parsed = None
        received_hex = None

        if telemetry_service.demo_mode:
            # Demo mode - simulate response
            received_hex = f"FB {address:02X} {function:02X} 00 00"
            response_parsed = {
                "header": "0xFB",
                "address": f"0x{address:02X}",
                "function": f"0x{function:02X}",
                "function_name": function_name,
                "data": "Demo mode - no real data",
                "message": "Demo mode response"
            }
        else:
            # Real hardware mode
            if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
                try:
                    # Send raw frame and get response
                    servo = telemetry_service.hardware_manager.servo_bus

                    # CRITICAL: Acquire the bus lock to prevent telemetry polling conflicts
                    # The telemetry service polls servos at 20Hz, which can interfere with manual commands
                    async with telemetry_service.hardware_manager._bus_lock:
                        # Clear buffer and write the frame
                        await asyncio.to_thread(servo.ser.reset_input_buffer)
                        await asyncio.to_thread(servo.ser.write, frame_with_crc)
                        await asyncio.to_thread(servo.ser.flush)

                        # Read response header (FB addr func)
                        resp_hdr = await asyncio.to_thread(servo.ser.read, 3)

                        if len(resp_hdr) == 3 and resp_hdr[0] == 0xFB:
                            resp_addr = resp_hdr[1]
                            resp_func = resp_hdr[2]

                            # Validate address matches request
                            if resp_addr != address:
                                received_hex = " ".join(f"{b:02X}" for b in resp_hdr)
                                response_parsed = {
                                    "error": f"Address mismatch: sent to 0x{address:02X}, got response from 0x{resp_addr:02X}",
                                    "received_header": received_hex,
                                    "note": "This is likely a buffered response from a previous command. Try clearing the buffer or waiting longer."
                                }
                            # Validate function matches request (for read commands)
                            elif function != resp_func and function not in [0xF4, 0xF5, 0xF6, 0xF7, 0xFD, 0xFE]:
                                # Motion commands (F4-FE) may respond with different function codes
                                received_hex = resp_hdr.hex().upper()
                                response_parsed = {
                                    "error": f"Function mismatch: sent 0x{function:02X}, got response for 0x{resp_func:02X}",
                                    "received_header": received_hex,
                                    "note": "Servo may be responding to a different command. This could be buffer cross-talk."
                                }
                            else:
                                # Address and function match - proceed with normal parsing
                                response_parsed = None  # Will be set below

                            # Only parse payload if we have a valid header
                            if response_parsed is None:
                                # Determine expected payload length based on function
                                payload_lengths = {
                                    0x30: 7,  # carry (4) + value (2) + crc (1)
                                    0x31: 7,  # addition 48-bit (6) + crc (1)
                                    0x32: 3,  # speed i16 (2) + crc (1)
                                    0x33: 5,  # pulses i32 (4) + crc (1)
                                    0x34: 2,  # IO u8 (1) + crc (1)
                                    0x35: 7,  # raw addition (6) + crc (1)
                                    0x39: 5,  # axis error i32 (4) + crc (1)
                                    0x3A: 2,  # EN status (1) + crc (1)
                                    0x3B: 2,  # zero status (1) + crc (1)
                                    0x3D: 2,  # release protect (1) + crc (1)
                                    0x3E: 2,  # protect status (1) + crc (1)
                                    0xF1: 2,  # motor status (1) + crc (1)
                                }

                                payload_len = payload_lengths.get(resp_func, 2)  # Default to 2 (1 byte + crc)
                                payload = await asyncio.to_thread(servo.ser.read, payload_len)

                                if len(payload) == payload_len:
                                    full_response = resp_hdr + payload
                                    received_hex = " ".join(f"{b:02X}" for b in full_response)

                                    # Verify CRC
                                    calc_crc = sum(full_response[:-1]) & 0xFF
                                    recv_crc = full_response[-1]
                                    crc_valid = calc_crc == recv_crc

                                    # Parse response data
                                    data_bytes = payload[:-1]  # Exclude CRC

                                    # Parse based on function
                                    parsed_data = {}
                                    if resp_func == 0x30 and len(data_bytes) == 6:  # Encoder carry
                                        carry = int.from_bytes(data_bytes[0:4], 'big', signed=True)
                                        value = int.from_bytes(data_bytes[4:6], 'big', signed=False)
                                        parsed_data = {"carry": carry, "value": value, "angle_deg": round((value / 16384.0) * 360.0, 2)}
                                    elif resp_func == 0x32 and len(data_bytes) == 2:  # Speed
                                        speed = int.from_bytes(data_bytes, 'big', signed=True)
                                        parsed_data = {"speed_rpm": speed, "direction": "CCW" if speed > 0 else "CW" if speed < 0 else "STOPPED"}
                                    elif resp_func == 0x33 and len(data_bytes) == 4:  # Pulses
                                        pulses = int.from_bytes(data_bytes, 'big', signed=True)
                                        parsed_data = {"pulses": pulses}
                                    elif resp_func == 0x34 and len(data_bytes) == 1:  # I/O
                                        io_bits = data_bytes[0]
                                        parsed_data = {
                                            "IN1": bool(io_bits & 0x01),
                                            "IN2": bool(io_bits & 0x02),
                                            "OUT1": bool(io_bits & 0x04),
                                            "OUT2": bool(io_bits & 0x08)
                                        }
                                    elif resp_func == 0x39 and len(data_bytes) == 4:  # Angle error
                                        error = int.from_bytes(data_bytes, 'big', signed=True)
                                        parsed_data = {"error_counts": error, "error_deg": round((error / 16384.0) * 360.0, 3)}
                                    elif resp_func == 0x3A and len(data_bytes) == 1:  # EN status
                                        parsed_data = {"enabled": bool(data_bytes[0])}
                                    elif resp_func == 0xF1 and len(data_bytes) == 1:  # Motor status
                                        status_map = {0: "FAIL", 1: "STOP", 2: "SPEED_UP", 3: "SPEED_DOWN", 4: "FULL_SPEED", 5: "HOMING"}
                                        parsed_data = {"status_code": data_bytes[0], "status": status_map.get(data_bytes[0], "UNKNOWN")}
                                    else:
                                        parsed_data = {"raw_hex": data_bytes.hex().upper()}

                                    response_parsed = {
                                        "header": f"0x{resp_hdr[0]:02X}",
                                        "address": f"0x{resp_addr:02X}",
                                        "function": f"0x{resp_func:02X}",
                                        "function_name": function_names.get(resp_func, f"Unknown (0x{resp_func:02X})"),
                                        "data": parsed_data,
                                        "crc": f"0x{recv_crc:02X}",
                                        "crc_valid": crc_valid
                                    }
                                else:
                                    received_hex = resp_hdr.hex().upper()
                                    response_parsed = {"error": f"Short payload: got {len(payload)}, expected {payload_len}"}
                        else:
                            if len(resp_hdr) > 0:
                                received_hex = resp_hdr.hex().upper()
                                response_parsed = {"error": f"Invalid response header: {resp_hdr.hex().upper()}"}
                            else:
                                response_parsed = {"error": "No response (timeout)"}

                except Exception as e:
                    response_parsed = {"error": str(e)}
            else:
                response_parsed = {"error": "Hardware manager not available"}

        result = {
            "status": "success",
            "axis": axis.upper(),
            "command": "raw_uart",
            "timestamp": datetime.now().isoformat(),
            "request": {
                "hex_input": request.hex_data,
                "hex_sent": sent_hex,
                "parsed": request_parsed
            },
            "response": {
                "success": received_hex is not None,
                "hex_received": received_hex or "No response",
                "parsed": response_parsed
            }
        }

        # Save to database
        try:
            await save_servo_command(
                axis=axis.upper(),
                command="raw_uart",
                status="success",
                request=result["request"],
                response=result["response"]
            )
        except Exception as db_error:
            # Don't fail the command if database save fails
            pass

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid hex data: {str(e)}")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "raw_uart",
            "message": str(e)
        }

# ========== ADVANCED SERVO COMMANDS ==========

@router.post("/console/{axis}/release-locked-rotor")
async def console_release_locked_rotor(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Release locked-rotor protection"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    if telemetry_service.demo_mode:
        return {
            "status": "success",
            "axis": axis.upper(),
            "command": "release_locked_rotor",
            "request": {},
            "response": {"success": True, "message": "Locked-rotor protection released (demo)"}
        }

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 3D <crc>)
            frame = bytes([0xFA, addr, 0x3D])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # CRITICAL: Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                result = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.release_protect,
                    addr
                )

            # Response is FB <addr> 3D <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x3D, result])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "release_locked_rotor",
                "request": {"hex_sent": sent_hex},
                "response": {"success": result == 1, "result": result, "hex_received": resp_hex, "message": "Locked-rotor protection released"}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "release_locked_rotor",
            "message": str(e)
        }

@router.post("/console/{axis}/restart")
async def console_restart_device(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Restart device (soft reboot)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    if telemetry_service.demo_mode:
        return {
            "status": "success",
            "axis": axis.upper(),
            "command": "restart",
            "request": {},
            "response": {"success": True, "message": "Device restarted (demo)"}
        }

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 41 <crc>)
            frame = bytes([0xFA, addr, 0x41])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # CRITICAL: Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                result = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.restart_motor,
                    addr
                )

            # Response is FB <addr> 41 <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x41, result])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "restart",
                "request": {"hex_sent": sent_hex},
                "response": {"success": result == 1, "result": result, "hex_received": resp_hex, "message": "Device restart command sent"}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "restart",
            "message": str(e)
        }

@router.post("/console/{axis}/factory-reset")
async def console_factory_reset(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Restore factory defaults"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    if telemetry_service.demo_mode:
        return {
            "status": "success",
            "axis": axis.upper(),
            "command": "factory_reset",
            "request": {},
            "response": {"success": True, "message": "Factory defaults restored (demo)"}
        }

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 3F <crc>)
            frame = bytes([0xFA, addr, 0x3F])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # CRITICAL: Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                result = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.restore_factory,
                    addr
                )

            # Response is FB <addr> 3F <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x3F, result])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "factory_reset",
                "request": {"hex_sent": sent_hex},
                "response": {"success": result == 1, "result": result, "hex_received": resp_hex, "message": "Factory defaults restored. Device will reboot."}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "factory_reset",
            "message": str(e)
        }

@router.get("/console/{axis}/read-speed")
async def console_read_speed(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Read real-time speed (function 0x32)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    if telemetry_service.demo_mode:
        return {
            "status": "success",
            "axis": axis.upper(),
            "command": "read_speed",
            "request": {},
            "response": {"success": True, "speed_rpm": 0, "message": "Demo mode"}
        }

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 32 <crc>)
            frame = bytes([0xFA, addr, 0x32])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                speed_rpm = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.read_speed_rpm,
                    addr
                )

            # Response is FB <addr> 32 <speed_high> <speed_low> <crc> (signed 16-bit)
            speed_bytes = speed_rpm.to_bytes(2, byteorder='big', signed=True)
            resp_frame = bytes([0xFB, addr, 0x32]) + speed_bytes
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "read_speed",
                "request": {"hex_sent": sent_hex},
                "response": {
                    "success": True,
                    "speed_rpm": speed_rpm,
                    "direction": "CCW" if speed_rpm > 0 else "CW" if speed_rpm < 0 else "STOPPED",
                    "hex_received": resp_hex
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "read_speed",
            "message": str(e)
        }

@router.get("/console/{axis}/read-angle-error")
async def console_read_angle_error(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Read angle error (function 0x39)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    if telemetry_service.demo_mode:
        return {
            "status": "success",
            "axis": axis.upper(),
            "command": "read_angle_error",
            "request": {},
            "response": {"success": True, "error_counts": 0, "error_deg": 0.0, "message": "Demo mode"}
        }

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 39 <crc>)
            frame = bytes([0xFA, addr, 0x39])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                error_counts = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.read_axis_error,
                    addr
                )

            # Convert counts to degrees (16384 counts = 360 degrees)
            error_deg = (error_counts / 16384.0) * 360.0

            # Response is FB <addr> 39 <err3> <err2> <err1> <err0> <crc> (signed 32-bit)
            error_bytes = error_counts.to_bytes(4, byteorder='big', signed=True)
            resp_frame = bytes([0xFB, addr, 0x39]) + error_bytes
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "read_angle_error",
                "request": {"hex_sent": sent_hex},
                "response": {
                    "success": True,
                    "error_counts": error_counts,
                    "error_deg": round(error_deg, 3),
                    "message": f"Angle error: {error_deg:.3f}°",
                    "hex_received": resp_hex
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "read_angle_error",
            "message": str(e)
        }

@router.get("/console/{axis}/read-en-pin")
async def console_read_en_pin(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Read EN pin state (function 0x3A)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    if telemetry_service.demo_mode:
        return {
            "status": "success",
            "axis": axis.upper(),
            "command": "read_en_pin",
            "request": {},
            "response": {"success": True, "enabled": True, "message": "Demo mode"}
        }

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 3A <crc>)
            frame = bytes([0xFA, addr, 0x3A])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                en_status = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.read_en_status,
                    addr
                )

            enabled = bool(en_status)

            # Response is FB <addr> 3A <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x3A, en_status])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "read_en_pin",
                "request": {"hex_sent": sent_hex},
                "response": {
                    "success": True,
                    "enabled": enabled,
                    "raw_value": en_status,
                    "message": f"EN pin: {'Enabled' if enabled else 'Disabled'}",
                    "hex_received": resp_hex
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "read_en_pin",
            "message": str(e)
        }

@router.get("/console/{axis}/read-all-params")
async def console_read_all_params(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Read all configuration parameters (function 0x47) - 34 byte bulk read"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    if telemetry_service.demo_mode:
        # Return demo data (34 bytes of zeros)
        demo_params = bytes([0] * 34)
        return {
            "status": "success",
            "axis": axis.upper(),
            "command": "read_all_params",
            "request": {},
            "response": {
                "success": True,
                "params_hex": demo_params.hex().upper(),
                "length": 34,
                "message": "Demo mode - dummy params"
            }
        }

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 47 <crc>)
            frame = bytes([0xFA, addr, 0x47])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                params_bytes = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.read_all_params,
                    addr
                )

            # Parse the 34-byte parameter block (based on MKS sample code)
            parsed = {}
            if len(params_bytes) >= 34:
                # Byte 0: Mode (0=CR_OPEN, 1=CR_CLOSE, 2=CR_vFOC, 3=SR_OPEN, 4=SR_CLOSE, 5=SR_vFOC)
                mode_val = params_bytes[0]
                mode_map = {0: "CR_OPEN", 1: "CR_CLOSE", 2: "CR_vFOC", 3: "SR_OPEN", 4: "SR_CLOSE", 5: "SR_vFOC"}
                parsed["mode"] = mode_val
                parsed["mode_text"] = mode_map.get(mode_val, f"Unknown({mode_val})")

                # Bytes 1-2: Work Current (u16 big-endian) in mA
                current_ma = int.from_bytes(params_bytes[1:3], 'big', signed=False)
                parsed["current_ma"] = current_ma

                # Byte 3: Hold Current (0=10%, 1=20%, ..., 8=90%)
                hold_pct_val = params_bytes[3]
                hold_pct = (hold_pct_val + 1) * 10 if hold_pct_val <= 8 else 50  # Default to 50% if invalid
                parsed["hold_current_pct"] = hold_pct

                # Byte 4: Microstep
                parsed["microstep"] = params_bytes[4]

                # Byte 5: EN Active (0=Low, 1=High, 2=Hold)
                en_val = params_bytes[5]
                en_map = {0: "Low", 1: "High", 2: "Hold"}
                parsed["en_active"] = en_val
                parsed["en_active_text"] = en_map.get(en_val, "Unknown")

                # Byte 6: Direction (0=CW, 1=CCW)
                dir_val = params_bytes[6]
                parsed["direction"] = dir_val
                parsed["direction_text"] = "CW" if dir_val == 0 else "CCW"

                # Byte 7: Auto Screen Off (0=Disable, 1=Enable)
                parsed["auto_screen_off"] = params_bytes[7]

                # Byte 8: Stall Protection (0=Disable, 1=Enable)
                parsed["stall_protect"] = params_bytes[8]

                # Byte 9: Microstep Interpolation (0=Disable, 1=Enable)
                parsed["microstep_interp"] = params_bytes[9]

                # Byte 10: Baudrate (1=9600, 2=19200, 3=25000, 4=38400, 5=57600, 6=115200, 7=256000)
                baud_val = params_bytes[10]
                baud_map = {1: 9600, 2: 19200, 3: 25000, 4: 38400, 5: 57600, 6: 115200, 7: 256000}
                parsed["baudrate"] = baud_map.get(baud_val, 115200)

                # Byte 11: Slave Address
                parsed["slave_addr"] = params_bytes[11]

                # Byte 12: Group Address
                parsed["group_addr"] = params_bytes[12]

                # Bytes 13-14: Response Mode (skip for now)

                # Byte 16: Key Lock (0=Unlock, 1=Lock)
                parsed["key_lock"] = params_bytes[16]

                # Byte 17: Limit Trigger Level (0=Low, 1=High)
                trig_val = params_bytes[17]
                parsed["limit_trigger"] = trig_val
                parsed["limit_trigger_text"] = "Low" if trig_val == 0 else "High"

                # Byte 18: Limit Direction (0=CW, 1=CCW)
                limit_dir_val = params_bytes[18]
                parsed["limit_direction"] = limit_dir_val
                parsed["limit_direction_text"] = "CW" if limit_dir_val == 0 else "CCW"

                # Bytes 19-20: Limit Speed (u16 big-endian) in RPM
                limit_speed_rpm = int.from_bytes(params_bytes[19:21], 'big', signed=False)
                parsed["limit_speed_rpm"] = limit_speed_rpm

                # Byte 21: Limit Enable (0=Disable, 1=Enable)
                parsed["limit_enable"] = params_bytes[21]

                # Bytes 22-25: No-limit Return Distance (4 bytes, hex format)
                return_distance_hex = params_bytes[22:26].hex().upper()
                parsed["no_limit_return_distance_hex"] = return_distance_hex

                # Byte 26: Home Mode (0=Limit Home, 1=noLimit Home)
                home_mode_val = params_bytes[26]
                parsed["home_mode"] = home_mode_val
                parsed["home_mode_text"] = "Limit Home" if home_mode_val == 0 else "noLimit Home"

                # Bytes 27-28: Home Current (u16 big-endian) in mA
                home_current_ma = int.from_bytes(params_bytes[27:29], 'big', signed=False)
                parsed["home_current_ma"] = home_current_ma

                # Byte 29: Limit Remap (0=Disable, 1=Enable)
                parsed["limit_remap"] = params_bytes[29]

                # Byte 30: Single Circle Home Mode (0=Disable, 1=DirMode, 2=NearMode)
                single_home_val = params_bytes[30]
                single_home_map = {0: "Disable", 1: "DirMode", 2: "NearMode"}
                parsed["single_circle_home_mode"] = single_home_val
                parsed["single_circle_home_mode_text"] = single_home_map.get(single_home_val, "Unknown")

                # Byte 32: Single Circle Home Speed
                if len(params_bytes) > 32:
                    parsed["single_circle_home_speed"] = params_bytes[32]

                # Byte 33: Single Circle Home Direction (0=CW, 1=CCW)
                if len(params_bytes) > 33:
                    single_dir_val = params_bytes[33]
                    parsed["single_circle_home_direction"] = single_dir_val
                    parsed["single_circle_home_direction_text"] = "CW" if single_dir_val == 0 else "CCW"

            # Format response hex (FB <addr> 47 <34 bytes> <crc>)
            resp_frame = bytes([0xFB, addr, 0x47]) + params_bytes
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "read_all_params",
                "request": {"hex_sent": sent_hex},
                "response": {
                    "success": True,
                    "params_hex": params_bytes.hex().upper(),
                    "params_bytes": list(params_bytes),
                    "length": len(params_bytes),
                    "parsed": parsed,
                    "hex_received": resp_hex,
                    "message": f"Read {len(params_bytes)} configuration bytes"
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "read_all_params",
            "message": str(e)
        }

@router.get("/console/{axis}/read-status-bundle")
async def console_read_status_bundle(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Read comprehensive status bundle (function 0x48) - efficient bulk status read"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    if telemetry_service.demo_mode:
        # Return demo status bundle
        return {
            "status": "success",
            "axis": axis.upper(),
            "command": "read_status_bundle",
            "request": {},
            "response": {
                "success": True,
                "encoder_value": 0,
                "speed_rpm": 0,
                "pulses": 0,
                "io_state": {"IN1": False, "IN2": False, "OUT1": False, "OUT2": False},
                "en_status": True,
                "zero_status": 0,
                "stall_status": False,
                "angle_error": 0,
                "message": "Demo mode - dummy status"
            }
        }

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 48 <crc>)
            frame = bytes([0xFA, addr, 0x48])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                status_bytes = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.read_all_status,
                    addr
                )

            # Parse status bundle (based on MKS app behavior)
            # Status bundle format (total ~29 bytes):
            # [0-6]: Encoder carry + value (7 bytes)
            # [7-8]: Speed i16 (2 bytes)
            # [9-12]: Pulse count i32 (4 bytes)
            # [13]: IO bitmap (1 byte)
            # [14]: EN status (1 byte)
            # [15]: Zero status (1 byte)
            # [16]: Stall protect status (1 byte)
            # [17-20]: Angle error i32 (4 bytes)
            # [21+]: Additional status data

            parsed = {}
            if len(status_bytes) >= 21:
                # Encoder value (6 bytes: 4 carry + 2 value)
                carry = int.from_bytes(status_bytes[0:4], 'big', signed=True)
                value = int.from_bytes(status_bytes[4:6], 'big', signed=False)
                encoder_deg = round((value / 16384.0) * 360.0, 2)
                parsed["encoder_carry"] = carry
                parsed["encoder_value"] = value
                parsed["encoder_deg"] = encoder_deg

                # Speed (bytes 7-8, signed 16-bit)
                speed_rpm = int.from_bytes(status_bytes[7:9], 'big', signed=True)
                parsed["speed_rpm"] = speed_rpm
                parsed["speed_direction"] = "CCW" if speed_rpm > 0 else "CW" if speed_rpm < 0 else "STOP"

                # Pulse count (bytes 9-12, signed 32-bit)
                pulses = int.from_bytes(status_bytes[9:13], 'big', signed=True)
                parsed["pulses"] = pulses

                # IO bitmap (byte 13)
                io_bits = status_bytes[13]
                parsed["io_state"] = {
                    "IN1": bool(io_bits & 0x01),
                    "IN2": bool(io_bits & 0x02),
                    "OUT1": bool(io_bits & 0x04),
                    "OUT2": bool(io_bits & 0x08)
                }

                # EN status (byte 14)
                parsed["en_enabled"] = bool(status_bytes[14])

                # Zero status (byte 15: 0=idle, 1=zeroing, 2=success, 3=fail)
                parsed["zero_status"] = status_bytes[15]
                zero_map = {0: "idle", 1: "zeroing", 2: "success", 3: "fail"}
                parsed["zero_status_text"] = zero_map.get(status_bytes[15], "unknown")

                # Stall protect (byte 16)
                parsed["stall_protected"] = bool(status_bytes[16])

                # Angle error (bytes 17-20, signed 32-bit)
                if len(status_bytes) >= 21:
                    error_counts = int.from_bytes(status_bytes[17:21], 'big', signed=True)
                    error_deg = round((error_counts / 16384.0) * 360.0, 3)
                    parsed["angle_error_counts"] = error_counts
                    parsed["angle_error_deg"] = error_deg

            # Format response hex
            resp_frame = bytes([0xFB, addr, 0x48]) + status_bytes
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "read_status_bundle",
                "request": {"hex_sent": sent_hex},
                "response": {
                    "success": True,
                    "raw_hex": status_bytes.hex().upper(),
                    "raw_bytes": list(status_bytes),
                    "length": len(status_bytes),
                    "parsed": parsed,
                    "hex_received": resp_hex,
                    "message": f"Status bundle: {len(status_bytes)} bytes"
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "axis": axis.upper(),
            "command": "read_status_bundle",
            "message": str(e)
        }

# ========== COMMAND HISTORY ==========

@router.get("/console/history")
async def get_command_history(limit: int = 20) -> Dict[str, Any]:
    """Get recent command history from database"""
    try:
        history = await get_servo_command_history(limit=min(limit, 50))
        return {
            "status": "success",
            "count": len(history),
            "commands": history
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "commands": []
        }
# ========== CONFIGURATION COMMANDS ==========

@router.post("/console/{axis}/set-mode")
async def console_set_mode(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set motor control mode (CR/SR, OPEN/CLOSE/vFOC)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    mode = request.get("mode", 5)  # Default: SR_vFOC

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 82 <mode> <crc>)
            frame = bytes([0xFA, addr, 0x82, mode])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # CRITICAL: Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                status = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.set_mode,
                addr,
                mode
            )

            # Response is FB <addr> 82 <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x82, status])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_mode",
                "request": {"mode": mode, "hex_sent": sent_hex},
                "response": {"success": status == 1, "status_byte": status, "hex_received": resp_hex}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-work-current")
async def console_set_work_current(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set work current (mA)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    current_ma = request.get("current_ma", 1600)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 83 <current_hi> <current_lo> <crc>)
            current_bytes = current_ma.to_bytes(2, 'big')
            frame = bytes([0xFA, addr, 0x83]) + current_bytes
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # CRITICAL: Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                status = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.set_current_ma,
                    addr,
                    current_ma
                )

            # Response is FB <addr> 83 <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x83, status])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_work_current",
                "request": {"current_ma": current_ma, "hex_sent": sent_hex},
                "response": {"success": status == 1, "status_byte": status, "hex_received": resp_hex}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-hold-current")
async def console_set_hold_current(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set hold current (10-90%)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    percent = request.get("percent", 50)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 9B <percent_index> <crc>)
            # The library converts percent to index (percent/10 - 1), but for logging we use raw percent
            percent_index = (percent // 10) - 1 if percent >= 10 else 0
            frame = bytes([0xFA, addr, 0x9B, percent_index])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # CRITICAL: Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                status = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.set_hold_current_percent,
                    addr,
                    percent
                )

            # Response is FB <addr> 9B <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x9B, status])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_hold_current",
                "request": {"percent": percent, "hex_sent": sent_hex},
                "response": {"success": status == 1, "status_byte": status, "hex_received": resp_hex}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-microstep")
async def console_set_microstep(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set microstep subdivision"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    microstep = request.get("microstep", 16)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            # Build hex frame for logging (FA <addr> 84 <microstep> <crc>)
            # Note: microstep 256 is encoded as 0 (wraps around in byte)
            microstep_byte = microstep & 0xFF
            frame = bytes([0xFA, addr, 0x84, microstep_byte])
            crc = sum(frame) & 0xFF
            frame_with_crc = frame + bytes([crc])
            sent_hex = " ".join(f"{b:02X}" for b in frame_with_crc)

            # CRITICAL: Acquire bus lock to prevent telemetry conflicts
            async with telemetry_service.hardware_manager._bus_lock:
                status = await asyncio.to_thread(
                    telemetry_service.hardware_manager.servo_bus.set_microstep,
                    addr,
                    microstep
                )

            # Response is FB <addr> 84 <status> <crc>
            resp_frame = bytes([0xFB, addr, 0x84, status])
            resp_crc = sum(resp_frame) & 0xFF
            resp_hex = " ".join(f"{b:02X}" for b in (resp_frame + bytes([resp_crc])))

            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_microstep",
                "request": {"microstep": microstep, "hex_sent": sent_hex},
                "response": {"success": status == 1, "status_byte": status, "hex_received": resp_hex}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-en-active")
async def console_set_en_active(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set EN pin active mode (0=active_low, 1=active_high, 2=always_on)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    en_mode = request.get("en_mode", 2)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            status = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.set_en_active,
                addr,
                en_mode
            )
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_en_active",
                "request": {"en_mode": en_mode},
                "response": {"success": status == 1, "status_byte": status}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-direction")
async def console_set_direction(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set direction polarity (0=CW, 1=CCW)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    direction = request.get("direction", 0)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            status = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.set_dir,
                addr,
                direction
            )
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_direction",
                "request": {"direction": direction},
                "response": {"success": status == 1, "status_byte": status}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-autosleep")
async def console_set_autosleep(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set auto-sleep mode"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    enable = request.get("enable", False)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            status = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.set_autosleep,
                addr,
                enable
            )
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_autosleep",
                "request": {"enable": enable},
                "response": {"success": status == 1, "status_byte": status}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-stall-protect")
async def console_set_stall_protect(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set stall protection"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    enable = request.get("enable", True)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            status = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.set_stall_protect,
                addr,
                enable
            )
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_stall_protect",
                "request": {"enable": enable},
                "response": {"success": status == 1, "status_byte": status}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-microstep-interpolation")
async def console_set_microstep_interpolation(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set microstep interpolation"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    enable = request.get("enable", True)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            status = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.set_microstep_interpolation,
                addr,
                enable
            )
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_microstep_interpolation",
                "request": {"enable": enable},
                "response": {"success": status == 1, "status_byte": status}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

# ========== HOMING CONFIGURATION ==========

@router.post("/console/{axis}/set-nolimit-homing")
async def console_set_nolimit_homing(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set no-limit homing parameters (for El/CL without limit switches)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    reverse_ticks = request.get("reverse_ticks", 8192)  # ~180 deg
    mode = request.get("mode", 1)  # 1 = no-limit mode
    current_ma = request.get("current_ma", 400)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            status = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.set_nolimit_home,
                addr,
                reverse_ticks,
                mode,
                current_ma
            )
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_nolimit_homing",
                "request": {"reverse_ticks": reverse_ticks, "mode": mode, "current_ma": current_ma},
                "response": {"success": status == 1, "status_byte": status}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-limit-remap")
async def console_set_limit_remap(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Remap limits to EN/DIR pins (serial mode)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    enable = request.get("enable", False)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            status = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.set_limit_remap,
                addr,
                enable
            )
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_limit_remap",
                "request": {"enable": enable},
                "response": {"success": status == 1, "status_byte": status}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

# ========== IO CONTROL ==========

@router.post("/console/{axis}/write-outputs")
async def console_write_outputs(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Write OUT1/OUT2 (SERVO57D only)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    out1 = request.get("out1", None)  # 0/1 or None to leave unchanged
    out2 = request.get("out2", None)

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            status = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.write_io,
                addr,
                out1,
                out2,
                True  # hold_others
            )
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "write_outputs",
                "request": {"out1": out1, "out2": out2},
                "response": {"success": status == 1, "status_byte": status}
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

# ========== PID TUNING ==========

@router.post("/console/{axis}/set-pid")
async def console_set_pid(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set PID parameters (Kp, Ki, Kd)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    kp = request.get("kp", None)
    ki = request.get("ki", None)
    kd = request.get("kd", None)

    results = {}
    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            servo_bus = telemetry_service.hardware_manager.servo_bus
            
            if kp is not None:
                status = await asyncio.to_thread(servo_bus.set_pos_kp, addr, kp)
                results["kp"] = {"value": kp, "success": status == 1}
            
            if ki is not None:
                status = await asyncio.to_thread(servo_bus.set_pos_ki, addr, ki)
                results["ki"] = {"value": ki, "success": status == 1}
            
            if kd is not None:
                status = await asyncio.to_thread(servo_bus.set_pos_kd, addr, kd)
                results["kd"] = {"value": kd, "success": status == 1}
            
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_pid",
                "request": {"kp": kp, "ki": ki, "kd": kd},
                "response": results
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

@router.post("/console/{axis}/set-acceleration")
async def console_set_acceleration(
    axis: str,
    request: dict,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set start/stop acceleration"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]
    start_accel = request.get("start_accel", None)
    stop_accel = request.get("stop_accel", None)

    results = {}
    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            servo_bus = telemetry_service.hardware_manager.servo_bus
            
            if start_accel is not None:
                status = await asyncio.to_thread(servo_bus.set_start_accel, addr, start_accel)
                results["start_accel"] = {"value": start_accel, "success": status == 1}
            
            if stop_accel is not None:
                status = await asyncio.to_thread(servo_bus.set_stop_accel, addr, stop_accel)
                results["stop_accel"] = {"value": stop_accel, "success": status == 1}
            
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "set_acceleration",
                "request": {"start_accel": start_accel, "stop_accel": stop_accel},
                "response": results
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

# ========== ADVANCED CONFIG ==========

@router.post("/console/{axis}/read-all-params")
async def console_read_all_params(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Read all parameters (34-byte snapshot)"""
    axis = validate_axis(axis)
    addr = SERVO_ADDRESSES[axis]

    try:
        if telemetry_service.hardware_manager and telemetry_service.hardware_manager.servo_bus:
            params_bytes = await asyncio.to_thread(
                telemetry_service.hardware_manager.servo_bus.read_all_params,
                addr
            )
            return {
                "status": "success",
                "axis": axis.upper(),
                "command": "read_all_params",
                "request": {},
                "response": {
                    "success": True,
                    "params_hex": params_bytes.hex().upper(),
                    "length": len(params_bytes)
                }
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware not available")
    except Exception as e:
        return {"status": "error", "axis": axis.upper(), "message": str(e)}

# ========== MOVEMENT MODE CONTROL ==========

class MovementModeRequest(BaseModel):
    mode: str = Field(..., description="Movement mode: 'position', 'speed', or 'hybrid'")

@router.post("/console/set-movement-mode")
async def set_movement_mode(
    request: MovementModeRequest,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set global movement mode for servo control"""
    valid_modes = ["position", "speed", "hybrid"]
    if request.mode not in valid_modes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{request.mode}'. Must be one of: {', '.join(valid_modes)}"
        )

    try:
        if telemetry_service.hardware_manager:
            await telemetry_service.hardware_manager.set_movement_mode(request.mode)
            return {
                "status": "success",
                "mode": request.mode,
                "message": f"Movement mode set to '{request.mode}'"
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@router.get("/console/movement-mode")
async def get_movement_mode(
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Get current movement mode"""
    try:
        if telemetry_service.hardware_manager:
            mode = telemetry_service.hardware_manager.get_movement_mode()
            return {
                "status": "success",
                "mode": mode
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


# ========== POSITION LOCKING ==========

@router.post("/console/lock-position/{axis}")
async def lock_position(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Lock position on specified axis (engage holding current)"""
    axis = axis.upper()
    if axis not in ["AZ", "EL", "CL"]:
        raise HTTPException(status_code=400, detail=f"Invalid axis '{axis}'")

    try:
        if telemetry_service.hardware_manager:
            success = await telemetry_service.hardware_manager.lock_position(axis)
            if success:
                return {
                    "status": "success",
                    "axis": axis,
                    "message": f"{axis} position locked"
                }
            else:
                return {
                    "status": "error",
                    "message": f"Failed to lock {axis} position"
                }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@router.post("/console/unlock-position/{axis}")
async def unlock_position(
    axis: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Unlock position on specified axis (release holding current)"""
    axis = axis.upper()
    if axis not in ["AZ", "EL", "CL"]:
        raise HTTPException(status_code=400, detail=f"Invalid axis '{axis}'")

    try:
        if telemetry_service.hardware_manager:
            success = await telemetry_service.hardware_manager.unlock_position(axis)
            if success:
                return {
                    "status": "success",
                    "axis": axis,
                    "message": f"{axis} position unlocked"
                }
            else:
                return {
                    "status": "error",
                    "message": f"Failed to unlock {axis} position"
                }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@router.get("/console/lock-states")
async def get_lock_states(
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Get lock state for all axes"""
    try:
        if telemetry_service.hardware_manager:
            lock_states = telemetry_service.hardware_manager.get_lock_states()
            return {
                "status": "success",
                "lock_states": lock_states
            }
        else:
            raise HTTPException(status_code=503, detail="Hardware manager not available")
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


# ========== MOTION PARAMETERS ==========

class MotionParamsRequest(BaseModel):
    settling_time_ms: Optional[int] = None
    working_current_ma: Optional[int] = None
    holding_current_ma: Optional[int] = None
    idle_current_ma: Optional[int] = None
    current_ramp_duration_ms: Optional[int] = None

@router.post("/console/motion-params")
async def set_motion_params(
    request: MotionParamsRequest,
    telemetry_service: TelemetryService = Depends(get_telemetry_service)
) -> Dict[str, Any]:
    """Set motion control parameters (anti-oscillation tuning)"""
    try:
        from ...core.config import settings

        # Update settings (runtime only, not persisted)
        if request.settling_time_ms is not None:
            settings.SETTLING_TIME_MS = request.settling_time_ms
        if request.working_current_ma is not None:
            settings.WORKING_CURRENT_MA = request.working_current_ma
        if request.holding_current_ma is not None:
            settings.HOLDING_CURRENT_MA = request.holding_current_ma
        if request.idle_current_ma is not None:
            settings.IDLE_CURRENT_MA = request.idle_current_ma
        if request.current_ramp_duration_ms is not None:
            settings.CURRENT_RAMP_DURATION_MS = request.current_ramp_duration_ms

        return {
            "status": "success",
            "message": "Motion parameters updated",
            "params": {
                "settling_time_ms": settings.SETTLING_TIME_MS,
                "working_current_ma": settings.WORKING_CURRENT_MA,
                "holding_current_ma": settings.HOLDING_CURRENT_MA,
                "idle_current_ma": settings.IDLE_CURRENT_MA,
                "current_ramp_duration_ms": settings.CURRENT_RAMP_DURATION_MS
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@router.get("/console/motion-params")
async def get_motion_params() -> Dict[str, Any]:
    """Get current motion control parameters"""
    try:
        from ...core.config import settings

        return {
            "status": "success",
            "params": {
                "settling_time_ms": settings.SETTLING_TIME_MS,
                "working_current_ma": settings.WORKING_CURRENT_MA,
                "holding_current_ma": settings.HOLDING_CURRENT_MA,
                "idle_current_ma": settings.IDLE_CURRENT_MA,
                "current_ramp_duration_ms": settings.CURRENT_RAMP_DURATION_MS
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

