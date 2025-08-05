#!/usr/bin/env python3
"""
🧩 overlay_inspect.py

This script detects and reports the currently active device tree overlays
on a Jetson AGX Orin device. It is useful for validating whether a .dtbo
(such as pin7_overlay.dtbo) has been successfully applied during boot.
"""

import os
import sys
import subprocess

def print_header(msg):
    print(f"\n{'=' * 60}\n{msg}\n{'=' * 60}")

def check_overlay_dir():
    overlay_path = "/proc/device-tree/overlays"
    if not os.path.exists(overlay_path):
        print("❌ Overlays directory not found. Are you sure a .dtbo was applied?")
        return []

    try:
        overlays = os.listdir(overlay_path)
        if not overlays:
            print("⚠️  No overlays currently active.")
        else:
            print("✅ Active overlays:")
            for name in overlays:
                print(f"  • {name}")
        return overlays
    except Exception as e:
        print(f"❌ Error reading overlays: {e}")
        return []

def check_extlinux_conf():
    conf_path = "/boot/extlinux/extlinux.conf"
    print_header("🔍 Inspecting extlinux.conf for overlay references")
    if not os.path.isfile(conf_path):
        print("❌ Could not find extlinux.conf")
        return

    try:
        with open(conf_path, 'r') as f:
            lines = f.readlines()
            for line in lines:
                if 'FDT' in line or 'overlays' in line:
                    print(f"  → {line.strip()}")
    except Exception as e:
        print(f"❌ Error reading extlinux.conf: {e}")

def verify_pin7_overlay(overlays):
    expected = ["pin7_overlay", "pin7_as_gpio"]
    found = any(name in overlays for name in expected)
    print_header("📍 Pin 7 Overlay Verification")
    if found:
        print("✅ Pin 7 overlay appears active.")
    else:
        print("⚠️  Pin 7 overlay not detected in overlays list.")
        print("   → Did you apply it correctly via extlinux.conf?")
        print("   → Did you reboot after copying the .dtbo file?")

def main():
    print_header("🧩 Overlay Inspection Tool")

    overlays = check_overlay_dir()
    check_extlinux_conf()
    verify_pin7_overlay(overlays)

    print("\nDone. If you expected an overlay to be present and it isn't listed,")
    print("double-check your .dtbo filename, extlinux.conf syntax, and ensure a reboot occurred.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n❗ Interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)
