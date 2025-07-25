"""
AetherLink Axis Calibration Module
Handles dual-end calibration with soft limit setup for each axis.
"""

import time
import yaml

# Load configuration
CONFIG_PATH = "software/config/settings.yaml"
from software.config.config_loader import get

soft_offset = float(get("system.soft_limit_offset_deg", 2.0))

def detect_stall(axis_name):
    """
    Placeholder for stall detection logic.
    Replace this with actual motor feedback/monitoring.
    """
    print(f"⚠️  Checking stall condition for {axis_name}...")
    time.sleep(0.2)
    return True  # Simulated stall for stub

def calibrate_axis(axis_name, port, max_degrees):
    """
    Simulates dual-end limit detection and midpoint calibration.
    """
    print(f"🔄 Calibrating {axis_name.upper()} on {port}...")

    # Sweep to one end
    print(f"  → Sweeping to negative limit...")
    while not detect_stall(axis_name):
        pass
    min_limit = 0  # Stub: replace with encoder count

    # Sweep to opposite end
    print(f"  → Sweeping to positive limit...")
    while not detect_stall(axis_name):
        pass
    max_limit = max_degrees  # Stub

    center = (min_limit + max_limit) / 2
    soft_min = min_limit + soft_offset
    soft_max = max_limit - soft_offset

    print(f"✅ {axis_name.upper()} limits set:")
    print(f"    Hard range: {min_limit}° - {max_limit}°")
    print(f"    Soft range: {soft_min}° - {soft_max}°")
    print(f"    Centered at: {center}°\n")

def run_full_calibration():
    """
    Runs calibration for all defined axes.
    """
    print("🚀 Running full calibration routine...\n")
    axes = get("motor_settings")
    ports = get("serial_ports")

    for axis_name in axes:
        port = ports.get(f"{axis_name}_motor", "/dev/null")
        max_deg = axes[axis_name]["max_degrees"]
        calibrate_axis(axis_name, port, max_deg)

    print("✅ All axes calibrated (simulated). Ready for targeting.\n")
