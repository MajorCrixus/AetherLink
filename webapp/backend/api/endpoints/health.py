"""
Health check and system status endpoints
"""

from datetime import datetime
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def health_check():
    """Basic health check endpoint"""
    return {
        "ok": True,
        "version": "1.0.0",
        "started_at": datetime.utcnow().isoformat(),
        "service": "aetherlink-backend"
    }

@router.get("/detailed")
async def detailed_health():
    """Detailed health check with service status"""
    # TODO: Get actual service status from dependency injection
    return {
        "ok": True,
        "version": "1.0.0",
        "started_at": datetime.utcnow().isoformat(),
        "services": {
            "telemetry": True,
            "websocket": True,
            "database": True
        },
        "system": {
            "cpu_percent": 25.0,
            "memory_percent": 45.0,
            "disk_percent": 60.0
        }
    }