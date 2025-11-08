#!/usr/bin/env python3
"""
wt901c_test.py - Comprehensive CLI test and calibration tool for WT901C-TTL IMU

Usage:
    python wt901c_test.py                           # Continuous display (all sensors)
    python wt901c_test.py --once                    # Single reading with details
    python wt901c_test.py --angles                  # Angles only (continuous)
    python wt901c_test.py --heading-only            # Headings only (continuous)
    python wt901c_test.py --calibrate-accel 5       # Calibrate accelerometer (5 seconds)
    python wt901c_test.py --calibrate-mag 20        # Calibrate magnetometer (20 seconds)
    python wt901c_test.py --calibrate-full          # Full calibration sequence
    python wt901c_test.py --zero-yaw                # Zero yaw angle
    python wt901c_test.py --configure               # Interactive configuration wizard
    python wt901c_test.py --json                    # JSON output (continuous)
    python wt901c_test.py --declination 3.1         # Apply local magnetic declination (deg)
"""

import argparse
import time
import sys
import json
import math
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from back_end.hardware.imu.wt901c import (
    WT901C, PID,
    Accel, Gyro, Angles, Mag, Quaternion, PressureAlt, GPSData, GPSAccuracy, PortStatus,
    AXIS_DIR_HORIZONTAL, AXIS_DIR_VERTICAL
)

# ----------------------------- Heading helpers -----------------------------

def _norm_deg(a: float) -> float:
    a %= 360.0
    return a if a >= 0 else a + 360.0

def compute_heading_deg_from(accel: Accel, mag: Mag) -> float:
    """
    Tilt-compensated magnetic heading in degrees (0..360).
    Uses accel (to estimate roll/pitch) and raw mag counts.
    """
    mx, my, mz = float(mag.mx), float(mag.my), float(mag.mz)
    ax, ay, az = float(accel.ax_g), float(accel.ay_g), float(accel.az_g)

    # Normalize accelerometer (gravity vector)
    g = math.sqrt(ax*ax + ay*ay + az*az) or 1.0
    axn, ayn, azn = ax / g, ay / g, az / g

    # roll, pitch from accel
    roll  = math.atan2(ayn, azn)
    pitch = math.atan2(-axn, math.sqrt(ayn*ayn + azn*azn))

    # Tilt compensation of mag vector
    mx2 = mx * math.cos(pitch) + mz * math.sin(pitch)
    my2 = (mx * math.sin(roll) * math.sin(pitch)
           + my * math.cos(roll)
           - mz * math.sin(roll) * math.cos(pitch))

    # Heading: 0° = x+, increases clockwise
    heading = math.degrees(math.atan2(-my2, mx2))
    return _norm_deg(heading)

def apply_declination(mag_heading: Optional[float], declination_deg: Optional[float]) -> Optional[float]:
    if mag_heading is None or declination_deg is None:
        return None
    return _norm_deg(mag_heading + declination_deg)

# ------------------------------- Displays ----------------------------------

def display_continuous(imu: WT901C, interval: float = 0.1, declination: Optional[float] = None):
    """Continuously display all sensor data"""
    print("WT901C-TTL IMU Monitor (Ctrl+C to stop)")
    print("=" * 120)

    try:
        while True:
            # Get all latest data
            accel = imu.last(PID.ACC)
            gyro = imu.last(PID.GYRO)
            angles = imu.last(PID.ANG)
            mag = imu.last(PID.MAG)

            # Build status line
            parts = []

            if angles:
                parts.append(f"R:{angles.roll_deg:6.1f}° P:{angles.pitch_deg:6.1f}° Y:{angles.yaw_deg:6.1f}°")

            if accel:
                parts.append(f"Acc:{accel.ax_g:5.2f},{accel.ay_g:5.2f},{accel.az_g:5.2f}g")

            if gyro:
                parts.append(f"Gyro:{gyro.gx_dps:6.1f},{gyro.gy_dps:6.1f},{gyro.gz_dps:6.1f}°/s")

            if mag:
                parts.append(f"Mag:{mag.mx:6d},{mag.my:6d},{mag.mz:6d}")

            # Heading (tilt-compensated)
            if accel and mag:
                hmag = compute_heading_deg_from(accel, mag)
                parts.append(f"Hdg:{hmag:6.1f}°")
                if declination is not None:
                    htrue = apply_declination(hmag, declination)
                    parts.append(f"True:{htrue:6.1f}°")

            if parts:
                print(f"\r{' | '.join(parts)}", end="", flush=True)
            else:
                print(f"\rWaiting for data...", end="", flush=True)

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n\nStopped.")

def display_heading_only(imu: WT901C, interval: float = 0.05, declination: Optional[float] = None):
    """Continuous headings only (fast)"""
    print("WT901C Heading (Ctrl+C to stop)")
    print("=" * 60)

    try:
        while True:
            accel = imu.last(PID.ACC)
            mag = imu.last(PID.MAG)

            if accel and mag:
                hmag = compute_heading_deg_from(accel, mag)
                line = f"\rMagnetic: {hmag:7.2f}°"
                if declination is not None:
                    htrue = apply_declination(hmag, declination)
                    line += f"   True: {htrue:7.2f}°"
                print(line, end="", flush=True)
            else:
                print("\rWaiting for accel+mag...", end="", flush=True)

            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n\nStopped.")

def display_angles_only(imu: WT901C, interval: float = 0.05):
    """Display angles only (high refresh rate)"""
    print("WT901C Angles (Ctrl+C to stop)")
    print("=" * 60)

    try:
        while True:
            angles = imu.last(PID.ANG)

            if angles:
                print(f"\rRoll: {angles.roll_deg:7.2f}°  "
                      f"Pitch: {angles.pitch_deg:7.2f}°  "
                      f"Yaw: {angles.yaw_deg:7.2f}°  ",
                      end="", flush=True)
            else:
                print(f"\rWaiting for data...", end="", flush=True)

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n\nStopped.")

def display_once(imu: WT901C, declination: Optional[float] = None):
    """Display detailed single reading"""
    print("\nWT901C-TTL IMU Status")
    print("=" * 80)

    time.sleep(0.5)  # Wait for data

    # Accelerometer
    if accel := imu.last(PID.ACC):
        print(f"\n📊 Accelerometer:")
        print(f"  X: {accel.ax_g:7.3f} g")
        print(f"  Y: {accel.ay_g:7.3f} g")
        print(f"  Z: {accel.az_g:7.3f} g")
        print(f"  Temperature: {accel.temp_c:.1f}°C")
        mag_g = (accel.ax_g**2 + accel.ay_g**2 + accel.az_g**2)**0.5
        print(f"  Magnitude: {mag_g:.3f} g")

    # Gyroscope
    if gyro := imu.last(PID.GYRO):
        print(f"\n🔄 Gyroscope:")
        print(f"  X: {gyro.gx_dps:7.2f} °/s")
        print(f"  Y: {gyro.gy_dps:7.2f} °/s")
        print(f"  Z: {gyro.gz_dps:7.2f} °/s")
        print(f"  Temperature: {gyro.temp_c:.1f}°C")

    # Angles
    if angles := imu.last(PID.ANG):
        print(f"\n🧭 Orientation (Euler Angles):")
        print(f"  Roll:  {angles.roll_deg:7.2f}°")
        print(f"  Pitch: {angles.pitch_deg:7.2f}°")
        print(f"  Yaw:   {angles.yaw_deg:7.2f}°")

    # Quaternion
    if quat := imu.last(PID.QUAT):
        print(f"\n🎯 Quaternion:")
        print(f"  q0 (w): {quat.q0:7.4f}")
        print(f"  q1 (x): {quat.q1:7.4f}")
        print(f"  q2 (y): {quat.q2:7.4f}")
        print(f"  q3 (z): {quat.q3:7.4f}")
        mag_q = (quat.q0**2 + quat.q1**2 + quat.q2**2 + quat.q3**2)**0.5
        print(f"  Magnitude: {mag_q:.4f} (should be ~1.0)")

    # Magnetometer + heading
    accel = imu.last(PID.ACC)
    mag = imu.last(PID.MAG)
    if mag:
        print(f"\n🧲 Magnetometer:")
        print(f"  X: {mag.mx:6d} LSB")
        print(f"  Y: {mag.my:6d} LSB")
        print(f"  Z: {mag.mz:6d} LSB")
        if accel:
            hmag = compute_heading_deg_from(accel, mag)
            print(f"  Tilt-compensated magnetic heading: {hmag:7.2f}°")
            if declination is not None:
                htrue = apply_declination(hmag, declination)
                print(f"  True heading (declination {declination:+.2f}°): {htrue:7.2f}°")

    # Barometer (if available)
    if baro := imu.last(PID.BARO):
        print(f"\n🌡️  Barometer:")
        print(f"  Pressure: {baro.pressure_pa:.1f} Pa")
        print(f"  Altitude: {baro.altitude_m:.1f} m")

    # GPS (if available)
    if gps := imu.last(PID.GPS):
        print(f"\n🛰️  GPS:")
        print(f"  Latitude:  {gps.lat_deg:.6f}°")
        print(f"  Longitude: {gps.lon_deg:.6f}°")
        print(f"  Height:    {gps.gps_height_m:.1f} m")
        print(f"  Yaw:       {gps.gps_yaw_deg:.1f}°")
        print(f"  Speed:     {gps.ground_speed_kmh:.1f} km/h")

    if gps_acc := imu.last(PID.GPS2):
        print(f"\n📡 GPS Accuracy:")
        print(f"  PDOP: {gps_acc.pdop:.2f}")
        print(f"  HDOP: {gps_acc.hdop:.2f}")
        print(f"  VDOP: {gps_acc.vdop:.2f}")
        print(f"  Satellites: {gps_acc.num_satellites}")

    # Digital Ports (if available)
    if ports := imu.last(PID.DPORT):
        print(f"\n🔌 Digital Ports:")
        print(f"  D0: {ports.d0}")
        print(f"  D1: {ports.d1}")
        print(f"  D2: {ports.d2}")
        print(f"  D3: {ports.d3}")

    print("=" * 80)

def display_json(imu: WT901C, interval: float = 0.1, declination: Optional[float] = None):
    """Output data as JSON (continuous)"""
    try:
        while True:
            data = {}

            if accel := imu.last(PID.ACC):
                data["accel"] = {"x": accel.ax_g, "y": accel.ay_g, "z": accel.az_g, "temp": accel.temp_c}

            if gyro := imu.last(PID.GYRO):
                data["gyro"] = {"x": gyro.gx_dps, "y": gyro.gy_dps, "z": gyro.gz_dps, "temp": gyro.temp_c}

            if angles := imu.last(PID.ANG):
                data["angles"] = {"roll": angles.roll_deg, "pitch": angles.pitch_deg, "yaw": angles.yaw_deg}

            accel = imu.last(PID.ACC)
            mag = imu.last(PID.MAG)
            if mag:
                data["mag"] = {"x": mag.mx, "y": mag.my, "z": mag.mz}
                if accel:
                    hmag = compute_heading_deg_from(accel, mag)
                    data["heading_mag_deg"] = hmag
                    if declination is not None:
                        data["heading_true_deg"] = apply_declination(hmag, declination)

            if quat := imu.last(PID.QUAT):
                data["quaternion"] = {"q0": quat.q0, "q1": quat.q1, "q2": quat.q2, "q3": quat.q3}

            if data:
                print(json.dumps(data))

            time.sleep(interval)

    except KeyboardInterrupt:
        pass

# ------------------------------- Calibration -------------------------------

def calibrate_accelerometer(imu: WT901C, duration: int):
    """Calibrate accelerometer"""
    print("\n" + "=" * 80)
    print("ACCELEROMETER CALIBRATION")
    print("=" * 80)
    print("\n⚠️  IMPORTANT: Place IMU on a LEVEL SURFACE and keep COMPLETELY STILL\n")
    input("Press Enter when ready...")

    imu.calibrate_with_config(accel=True, duration=duration)
    print("\n✅ Accelerometer calibration complete!")

def calibrate_magnetometer(imu: WT901C, duration: int):
    """Calibrate magnetometer"""
    print("\n" + "=" * 80)
    print("MAGNETOMETER CALIBRATION")
    print("=" * 80)
    print("\n⚠️  IMPORTANT: Rotate IMU in ALL directions (figure-8 patterns)")
    print("    Cover full 3D rotation space for best results\n")
    input("Press Enter to start...")

    imu.calibrate_with_config(mag=True, duration=duration)
    print("\n✅ Magnetometer calibration complete!")

def calibrate_full(imu: WT901C):
    """Full calibration sequence"""
    print("\n" + "=" * 80)
    print("FULL CALIBRATION SEQUENCE")
    print("=" * 80)

    # Step 1: Accelerometer
    print("\n📍 Step 1: Accelerometer Calibration")
    print("Place IMU on level surface and keep still")
    input("Press Enter when ready...")

    imu.unlock()
    imu.start_accel_calibration()
    print("Calibrating", end="", flush=True)
    for _ in range(5):
        time.sleep(1)
        print(".", end="", flush=True)
    imu.stop_accel_calibration()
    print(" Done!")

    # Step 2: Magnetometer
    print("\n📍 Step 2: Magnetometer Calibration")
    print("Rotate IMU in ALL directions (figure-8 patterns)")
    input("Press Enter to start...")

    imu.start_mag_calibration()
    print("Calibrating (rotate now)", end="", flush=True)
    for _ in range(20):
        time.sleep(1)
        print(".", end="", flush=True)
    imu.stop_mag_calibration()
    print(" Done!")

    # Step 3: Zero yaw
    print("\n📍 Step 3: Zero Yaw Angle")
    print("Point IMU in desired forward direction")
    if input("Zero yaw axis? (y/n): ").lower() == 'y':
        imu.set_angle_reference('z')
        print("Yaw zeroed!")

    # Save and lock
    print("\n💾 Saving configuration...")
    imu.save_config()
    time.sleep(0.5)
    imu.lock()

    print("\n✅ Full calibration complete!")
    print("=" * 80)

def zero_yaw(imu: WT901C):
    """Zero yaw angle"""
    print("\n" + "=" * 80)
    print("ZERO YAW ANGLE")
    print("=" * 80)
    print("\nPoint IMU in desired forward direction (0°)")
    input("Press Enter when ready...")

    imu.unlock()
    imu.set_angle_reference('z')
    imu.save_config()
    imu.lock()

    print("\n✅ Yaw angle zeroed!")

    # Show new angle
    time.sleep(0.5)
    if angles := imu.last(PID.ANG):
        print(f"\nNew yaw: {angles.yaw_deg:.1f}° (should be close to 0°)")

def interactive_config(imu: WT901C):
    """Interactive configuration wizard"""
    print("\n" + "=" * 80)
    print("INTERACTIVE CONFIGURATION WIZARD")
    print("=" * 80)

    # Output rate
    print("\n📊 Output Rate")
    rate = input("  Enter rate in Hz (1-200) [current: ?]: ").strip()
    rate_hz = int(rate) if rate else None

    # Output content
    print("\n📦 Output Content")
    print("  bit0=ACC, bit1=GYRO, bit2=ANG, bit3=MAG, bit4=BARO, bit5=QUAT")
    print("  Example: 7 = ACC+GYRO+ANG, 63 = All sensors")
    content = input("  Enter content mask (0-63) [current: ?]: ").strip()
    content_mask = int(content) if content else None

    # Installation direction
    print("\n🔧 Installation Direction")
    print("  0 = Horizontal (default)")
    print("  1 = Vertical")
    inst = input("  Enter installation (0/1) [current: 0]: ").strip()
    if inst == "1":
        inst_dir = AXIS_DIR_VERTICAL
    elif inst == "0":
        inst_dir = AXIS_DIR_HORIZONTAL
    else:
        inst_dir = None

    # Gyro auto-cal
    print("\n🔄 Gyroscope Auto-Calibration")
    gyro_cal = input("  Enable gyro auto-cal on startup? (y/n) [current: ?]: ").strip().lower()
    if gyro_cal == 'y':
        gyro_auto_cal = True
    elif gyro_cal == 'n':
        gyro_auto_cal = False
    else:
        gyro_auto_cal = None

    # Apply configuration
    print("\n⚙️  Applying configuration...")

    imu.configure_advanced(
        rate_hz=rate_hz,
        content_mask=content_mask,
        installation_dir=inst_dir,
        gyro_auto_cal=gyro_auto_cal
    )

    print("\n✅ Configuration applied and saved!")
    print("=" * 80)

# ----------------------------------- Main ----------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="WT901C-TTL IMU Test and Calibration Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                             # Continuous display (all sensors)
  %(prog)s --once                      # Single reading with details
  %(prog)s --angles                    # Angles only (high refresh)
  %(prog)s --heading-only              # Headings only (fast)
  %(prog)s --calibrate-accel 5         # Calibrate accelerometer (5s)
  %(prog)s --calibrate-mag 20          # Calibrate magnetometer (20s)
  %(prog)s --calibrate-full            # Full calibration sequence
  %(prog)s --zero-yaw                  # Zero yaw angle
  %(prog)s --configure                 # Interactive configuration
  %(prog)s --json                      # JSON output (continuous)
        """
    )

    parser.add_argument("--port", default="/dev/imu",
                       help="Serial port (default: /dev/imu)")
    parser.add_argument("--baud", type=int, default=9600,
                       help="Baud rate (default: 9600)")

    # Display modes
    parser.add_argument("--once", action="store_true",
                       help="Display single reading with details")
    parser.add_argument("--angles", action="store_true",
                       help="Display angles only (continuous)")
    parser.add_argument("--heading-only", action="store_true",
                       help="Display magnetic/true heading only (continuous)")
    parser.add_argument("--json", action="store_true",
                       help="Output JSON (continuous)")

    # Calibration
    parser.add_argument("--calibrate-accel", type=int, metavar="SECONDS",
                       help="Calibrate accelerometer for N seconds")
    parser.add_argument("--calibrate-mag", type=int, metavar="SECONDS",
                       help="Calibrate magnetometer for N seconds")
    parser.add_argument("--calibrate-full", action="store_true",
                       help="Full calibration sequence")
    parser.add_argument("--zero-yaw", action="store_true",
                       help="Zero yaw angle")

    # Configuration
    parser.add_argument("--configure", action="store_true",
                       help="Interactive configuration wizard")

    parser.add_argument("--interval", type=float, default=0.1,
                       help="Update interval in seconds (default: 0.1)")

    parser.add_argument("--declination", type=float, default=None,
                       help="Magnetic declination in degrees (adds true heading)")

    args = parser.parse_args()

    print(f"\nInitializing WT901C-TTL IMU on {args.port} @ {args.baud} baud...")

    try:
        imu = WT901C(port=args.port, baud=args.baud)
        imu.start()

        print("IMU started successfully!")
        print("Waiting for data...")
        time.sleep(1)

        # Execute requested action
        if args.calibrate_full:
            calibrate_full(imu)
        elif args.calibrate_accel:
            calibrate_accelerometer(imu, args.calibrate_accel)
        elif args.calibrate_mag:
            calibrate_magnetometer(imu, args.calibrate_mag)
        elif args.zero_yaw:
            zero_yaw(imu)
        elif args.configure:
            interactive_config(imu)
        elif args.json:
            display_json(imu, args.interval, args.declination)
        elif args.once:
            display_once(imu, args.declination)
        elif args.angles:
            display_angles_only(imu, )
        elif args.heading_only:
            display_heading_only(imu, max(0.02, args.interval), args.declination)
        else:
            display_continuous(imu, args.interval, args.declination)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user.")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        try:
            imu.stop()
            imu.close()
        except:
            pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
