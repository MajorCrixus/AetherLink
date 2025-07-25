"""
AetherLink Web UI Server (FastAPI)
Provides REST API for satellite browsing, system status, and antenna control
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import uvicorn
import json

app = FastAPI(title="AetherLink UI", version="0.1")

# Allow frontend access from any domain for now
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Load sample satellite database
DATA_FILE = Path("examples/sample_satellite.json")

@app.get("/api/satellites")
def get_satellites():
    if DATA_FILE.exists():
        with open(DATA_FILE, "r") as f:
            sat = json.load(f)
            return {"satellites": [sat]}  # Stub for single entry
    return {"satellites": []}

@app.get("/api/status")
def get_system_status():
    return {
        "controller": "Jetson AGX Orin",
        "motors": {
            "azimuth": "ready",
            "elevation": "ready",
            "pan": "ready"
        },
        "gps": "locked",
        "imu": "streaming",
        "sdr": "idle"
    }

@app.get("/api/target")
def get_current_target():
    return {
        "satellite": "INTELSAT-29E",
        "azimuth_deg": 179.7,
        "elevation_deg": 44.3,
        "signal_strength": 87.5
    }

# Only runs if launched directly
if __name__ == "__main__":
    uvicorn.run("software.ui.server:app", host="0.0.0.0", port=8000, reload=True)

