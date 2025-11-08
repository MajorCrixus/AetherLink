"""
API router configuration
"""

from fastapi import APIRouter

from .endpoints import health, config, servos, telemetry, cli, demo, sdr

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
api_router.include_router(servos.router, prefix="/servos", tags=["servos"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])
api_router.include_router(cli.router, prefix="/cli", tags=["cli"])
api_router.include_router(demo.router, prefix="/demo", tags=["demo"])
api_router.include_router(sdr.router, tags=["sdr"])