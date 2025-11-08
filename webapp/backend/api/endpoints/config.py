"""
Configuration management endpoints
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException


router = APIRouter()

# Mock configuration storage (in real implementation, use database)
_config_store: Dict[str, Any] = {
    "version": 1,
    "units": {"angles": "deg", "distance": "m"},
    "network": {
        "bind": "0.0.0.0",
        "port": 9000,
        "auth": {"enabled": False}
    },
    "demo": {"enabled": True, "profile": "lab"},
    "axes": {
        "AZ": {"min_deg": -300, "max_deg": 300, "zero_offset": 0, "max_rate_dps": 45},
        "EL": {"min_deg": -59, "max_deg": 59, "zero_offset": 0, "max_rate_dps": 20},
        "CL": {"min_deg": -10, "max_deg": 10, "zero_offset": 0, "max_rate_dps": 15}
    },
    "servos": {
        "AZ": {"addr": 1, "baud": 38400, "mode": "HOLD"},
        "EL": {"addr": 2, "baud": 38400, "mode": "HOLD"},
        "CL": {"addr": 3, "baud": 38400, "mode": "HOLD"}
    },
    "limits": {
        "in1_active_low": True,
        "in2_active_low": True,
        "debounce_ms": 5
    },
    "ephemeris": {
        "source": "space-track",
        "credentials_name": "stub",
        "stale_after_hours": 12
    },
    "api": {"rate_limits": {"move": 5}},
    "logging": {"level": "INFO", "persist": True}
}

@router.get("/")
async def get_config() -> Dict[str, Any]:
    """Get full system configuration"""
    return _config_store

@router.put("/")
async def update_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Update system configuration"""
    global _config_store

    # Validate basic structure
    if "version" not in config:
        raise HTTPException(status_code=400, detail="Configuration must include version")

    # Update configuration
    _config_store.update(config)

    return _config_store

@router.get("/section/{section}")
async def get_config_section(section: str) -> Dict[str, Any]:
    """Get a specific configuration section"""
    if section not in _config_store:
        raise HTTPException(status_code=404, detail=f"Configuration section '{section}' not found")

    return {section: _config_store[section]}

@router.put("/section/{section}")
async def update_config_section(section: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update a specific configuration section"""
    if section not in _config_store:
        raise HTTPException(status_code=404, detail=f"Configuration section '{section}' not found")

    _config_store[section] = data

    return {section: _config_store[section]}

@router.post("/export")
async def export_config() -> Dict[str, Any]:
    """Export configuration for backup"""
    return {
        "exported_at": "2024-01-01T00:00:00Z",
        "config": _config_store
    }

@router.post("/import")
async def import_config(config_data: Dict[str, Any]) -> Dict[str, str]:
    """Import configuration from backup"""
    global _config_store

    if "config" in config_data:
        _config_store = config_data["config"]
        return {"status": "success", "message": "Configuration imported successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid configuration format")