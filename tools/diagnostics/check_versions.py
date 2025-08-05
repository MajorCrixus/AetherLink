#!/usr/bin/env python3
"""
check_versions.py - Verifies software stack versions on Jetson AGX Orin

Checks versions for:
- Python
- Jetson.GPIO
- gpiod
- JetPack
- L4T
- Ubuntu

Outputs warnings if expected versions do not match.
"""

import subprocess
import sys
import platform

EXPECTED = {
    "Python": (3, 8),
    "gpiod": "2.3.0",
    "Jetson.GPIO": "2.1.1",
    "JetPack": "6.0",
    "L4T": "R36.4.4",
    "Ubuntu": "20.04"
}


# --- Helpers ---
def run_command(cmd):
    try:
        result = subprocess.check_output(cmd, shell=True, text=True).strip()
        return result
    except subprocess.CalledProcessError as e:
        return f"ERROR: {e}"


def check_python():
    version = sys.version_info
    return f"{version.major}.{version.minor}"


def check_jetson_gpio():
    try:
        import Jetson.GPIO as GPIO
        return GPIO.VERSION
    except ImportError:
        return "Not installed"


def check_gpiod():
    return run_command("gpiodetect --version")


def check_jetpack():
    output = run_command("dpkg-query --show nvidia-jetpack")
    if output.startswith("nvidia-jetpack"):
        return output.split()[1]
    return "Not found"


def check_l4t():
    return run_command("head -n 1 /etc/nv_tegra_release")


def check_ubuntu():
    output = run_command("lsb_release -d")
    if "Description:" in output:
        return output.split(":")[1].strip()
    return "Unknown"


def compare(name, actual, expected):
    print(f"\n▶️ {name} version:")
    print(f"   Detected: {actual}")
    if actual == expected or actual.startswith(expected):
        print(f"   ✅ Matches expected version ({expected})")
    else:
        print(f"   ⚠️ Expected {expected}, but got {actual}")


# --- Main ---
if __name__ == "__main__":
    print("\n🧪 Checking AetherLink software stack compatibility...\n")

    compare("Python", check_python(), f"{EXPECTED['Python'][0]}.{EXPECTED['Python'][1]}")
    compare("Jetson.GPIO", check_jetson_gpio(), EXPECTED["Jetson.GPIO"])
    compare("gpiod", check_gpiod(), EXPECTED["gpiod"])
    compare("JetPack", check_jetpack(), EXPECTED["JetPack"])
    compare("L4T", check_l4t(), EXPECTED["L4T"])
    compare("Ubuntu", check_ubuntu(), EXPECTED["Ubuntu"])

    print("\n✅ Version check complete. Review any warnings above.\n")
