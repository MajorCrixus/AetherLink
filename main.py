#!/usr/bin/env python3
"""
AetherLink Main Controller Entry Point
"""

import yaml
import os
import sys
import typer

app = typer.Typer(help="AetherLink Control Utility")

# ========== Load Configuration ==========
CONFIG_PATH = "software/config/settings.yaml"

try:
    with open(CONFIG_PATH, "r") as f:
        config = yaml.safe_load(f)
except FileNotFoundError:
    print(f"❌ Configuration file not found: {CONFIG_PATH}")
    sys.exit(1)

# ========== System Settings ==========
UI_ENABLED = config["system"].get("enable_ui", False)
SDR_ENABLED = config["system"].get("enable_sdr", False)

# ========== Commands ==========

@app.command()
def calibrate():
    """
    Run full axis calibration for Az/El/Pan
    """
    print("🔧 Starting calibration routine...")
    # TODO: Call controller.calibrate_all()
    print("✅ Calibration complete (stubbed)")

@app.command()
def ui():
    """
    Start the web UI server (if enabled)
    """
    if not UI_ENABLED:
        print("❌ UI is disabled in config")
        return
    print("🌐 Starting web server on port", config["ui"]["port"])
    # TODO: import ui.server and launch

@app.command()
def signal():
    """
    Begin signal scan or box scan routine
    """
    if not SDR_ENABLED:
        print("❌ SDR is disabled in config")
        return
    print("📡 Running beacon scan...")
    # TODO: Call sdr.scan()

@app.command()
def status():
    """
    Show system health and connection status
    """
    print("🛰️  System Name:", config["system"]["controller_name"])
    print("🔌 Serial Ports:")
    for name, port in config["serial_ports"].items():
        print(f"   {name}: {port}")
    print("✅ Configuration loaded")

if __name__ == "__main__":
    app()
