"""
Demo mode control endpoints
"""

from typing import Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class DemoModeRequest(BaseModel):
    enabled: bool
    profile: str = "lab"

# Available demo profiles
DEMO_PROFILES = {
    "lab": {
        "name": "Laboratory",
        "description": "Stable conditions, minimal noise",
        "gps_noise": 0.0001,
        "imu_noise": 0.1,
        "servo_lag": 0.95
    },
    "windy": {
        "name": "Windy Conditions",
        "description": "Wind affecting antenna stability",
        "gps_noise": 0.0005,
        "imu_noise": 0.5,
        "servo_lag": 0.90
    },
    "noisy-imu": {
        "name": "Noisy IMU",
        "description": "Poor IMU calibration or interference",
        "gps_noise": 0.0002,
        "imu_noise": 2.0,
        "servo_lag": 0.95
    },
    "urban-gps": {
        "name": "Urban GPS",
        "description": "GPS multipath and interference",
        "gps_noise": 0.002,
        "imu_noise": 0.2,
        "servo_lag": 0.95
    }
}

@router.get("/")
async def get_demo_status() -> Dict[str, Any]:
    """Get current demo mode status"""
    # TODO: Get actual status from telemetry service

    return {
        "enabled": True,
        "profile": "lab",
        "uptime_seconds": 3600,
        "telemetry_packets": 36000,
        "profiles_available": list(DEMO_PROFILES.keys())
    }

@router.post("/")
async def set_demo_mode(request: DemoModeRequest) -> Dict[str, Any]:
    """Enable/disable demo mode or change profile"""

    if request.enabled and request.profile not in DEMO_PROFILES:
        return {
            "status": "error",
            "message": f"Unknown profile '{request.profile}'. Available: {', '.join(DEMO_PROFILES.keys())}"
        }

    # TODO: Update telemetry service demo mode

    if request.enabled:
        return {
            "status": "success",
            "message": f"Demo mode enabled with profile '{request.profile}'",
            "enabled": True,
            "profile": request.profile
        }
    else:
        return {
            "status": "success",
            "message": "Demo mode disabled. Switched to hardware mode.",
            "enabled": False,
            "profile": None
        }

@router.get("/profiles")
async def get_demo_profiles() -> Dict[str, Any]:
    """Get available demo profiles"""
    return {
        "profiles": {
            name: {
                "name": info["name"],
                "description": info["description"]
            }
            for name, info in DEMO_PROFILES.items()
        }
    }

@router.get("/profiles/{profile}")
async def get_demo_profile(profile: str) -> Dict[str, Any]:
    """Get specific demo profile details"""
    if profile not in DEMO_PROFILES:
        return {"error": f"Profile '{profile}' not found"}

    return {"profile": profile, **DEMO_PROFILES[profile]}

@router.post("/seed")
async def set_demo_seed(seed: int) -> Dict[str, Any]:
    """Set deterministic seed for demo mode"""
    # TODO: Update demo simulator seed

    return {
        "status": "success",
        "message": f"Demo seed set to {seed}",
        "seed": seed
    }