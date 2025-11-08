#!/usr/bin/env python3
"""
Test script for motor limit protection system.
Demonstrates stall detection, software limits, and hardware limits.
"""

import time
import sys
from multi_motor_controller import MotorController
from limit_protection import LimitViolationType


def test_software_limits(mc: MotorController):
    """Test that software limits prevent out-of-range moves."""
    print("\n" + "="*60)
    print("TEST 1: Software Limit Validation")
    print("="*60)

    # Test elevation above maximum
    print("\n1. Testing elevation above maximum (95° > 90° max)...")
    try:
        mc.move_elevation(95.0, rpm=400)
        print("  ❌ FAIL: Move should have been rejected!")
        return False
    except ValueError as e:
        print(f"  ✅ PASS: Correctly rejected - {e}")

    # Test elevation below minimum
    print("\n2. Testing elevation below minimum (-5° < 0° min)...")
    try:
        mc.move_elevation(-5.0, rpm=400)
        print("  ❌ FAIL: Move should have been rejected!")
        return False
    except ValueError as e:
        print(f"  ✅ PASS: Correctly rejected - {e}")

    # Test cross above maximum
    print("\n3. Testing cross above maximum (50° > 45° max)...")
    try:
        mc.move_cross(50.0, rpm=300)
        print("  ❌ FAIL: Move should have been rejected!")
        return False
    except ValueError as e:
        print(f"  ✅ PASS: Correctly rejected - {e}")

    # Test cross below minimum
    print("\n4. Testing cross below minimum (-50° < -45° min)...")
    try:
        mc.move_cross(-50.0, rpm=300)
        print("  ❌ FAIL: Move should have been rejected!")
        return False
    except ValueError as e:
        print(f"  ✅ PASS: Correctly rejected - {e}")

    # Test valid move
    print("\n5. Testing valid move (elevation to 45°)...")
    try:
        mc.move_elevation(45.0, rpm=400)
        print("  ✅ PASS: Valid move accepted")
        return True
    except ValueError as e:
        print(f"  ❌ FAIL: Valid move rejected - {e}")
        return False


def test_warning_zones(mc: MotorController):
    """Test that warning zones are detected near limits."""
    print("\n" + "="*60)
    print("TEST 2: Warning Zone Detection")
    print("="*60)

    # Move elevation near maximum (within 5° warning zone)
    print("\n1. Moving elevation to 87° (3° from 90° limit)...")
    try:
        mc.move_elevation(87.0, rpm=200, safe=False)  # Bypass validation for test
        time.sleep(2.0)  # Wait for move to complete

        status = mc.check_motor_limits("elevation")
        if status and status.in_warning_zone:
            print(f"  ✅ PASS: Warning detected - {status.message}")
            return True
        else:
            print("  ❌ FAIL: Warning zone not detected")
            return False
    except Exception as e:
        print(f"  ❌ FAIL: Error during test - {e}")
        return False


def test_stall_detection(mc: MotorController):
    """Test stall detection (requires manual intervention)."""
    print("\n" + "="*60)
    print("TEST 3: Stall Detection (Manual Test)")
    print("="*60)

    print("\nThis test requires MANUAL INTERVENTION:")
    print("1. The elevation motor will start moving")
    print("2. MANUALLY BLOCK the motor to simulate a stall")
    print("3. The system should detect the stall")
    print("")

    response = input("Ready to proceed? (y/n): ")
    if response.lower() != 'y':
        print("Test skipped")
        return None

    print("\n1. Starting elevation motor (moving to 60°)...")
    mc.move_elevation(60.0, rpm=200, safe=False)

    print("2. BLOCK THE MOTOR NOW!")
    print("3. Monitoring for stall detection...")

    stall_detected = False
    for i in range(50):  # Monitor for 5 seconds
        time.sleep(0.1)
        status = mc.check_motor_limits("elevation")

        if status:
            print(f"   [{i*0.1:.1f}s] Protect flag: {status.protect_flag}, "
                  f"Axis error: {status.axis_error} ticks")

            if status.violation_type == LimitViolationType.STALL_DETECTED:
                print("\n  ✅ PASS: Stall detected successfully!")
                stall_detected = True

                # Test recovery
                print("\n4. Attempting automatic recovery...")
                protection = mc.get_protection_system()
                if protection and protection.recover_from_limit("elevation", status):
                    print("  ✅ PASS: Recovery successful")
                else:
                    print("  ⚠️  Recovery attempted")
                break

    if not stall_detected:
        print("\n  ⚠️  WARNING: Stall not detected")
        print("     This could mean:")
        print("     - Motor was not blocked sufficiently")
        print("     - Stall detection sensitivity needs adjustment")
        print("     - Motor moving too fast to detect")

    # Stop motor
    mc.servo.emergency_stop(mc.elevation.addr)
    return stall_detected


def test_hardware_limits(mc: MotorController):
    """Test hardware limit switches on azimuth motor."""
    print("\n" + "="*60)
    print("TEST 4: Hardware Limit Switches")
    print("="*60)

    print("\n1. Reading azimuth limit switch states...")
    try:
        limits = mc.read_limits("azimuth")
        print(f"   IN1 (CW limit): {'TRIGGERED' if limits['in1'] else 'not triggered'}")
        print(f"   IN2 (CCW limit): {'TRIGGERED' if limits['in2'] else 'not triggered'}")

        if limits['in1'] or limits['in2']:
            print("  ⚠️  WARNING: Limit switch currently triggered!")
            print("     Please move azimuth away from limit")
            return None

        print("  ✅ PASS: Limit switches read successfully")
        return True
    except Exception as e:
        print(f"  ❌ FAIL: Error reading limits - {e}")
        return False


def test_current_position_reading(mc: MotorController):
    """Test reading current positions and errors."""
    print("\n" + "="*60)
    print("TEST 5: Position and Error Monitoring")
    print("="*60)

    print("\n1. Reading current angles...")
    try:
        angles = mc.read_all_angles()
        print(f"   Azimuth: {angles['azimuth']:.2f}°")
        print(f"   Elevation: {angles['elevation']:.2f}°")
        print(f"   Cross: {angles['cross']:.2f}°")
        print("  ✅ PASS: Angles read successfully")
    except Exception as e:
        print(f"  ❌ FAIL: Error reading angles - {e}")
        return False

    print("\n2. Reading axis errors...")
    try:
        errors = mc.read_all_errors()
        print(f"   Azimuth error: {errors['azimuth']} ticks")
        print(f"   Elevation error: {errors['elevation']} ticks")
        print(f"   Cross error: {errors['cross']} ticks")
        print("  ✅ PASS: Errors read successfully")
    except Exception as e:
        print(f"  ❌ FAIL: Error reading errors - {e}")
        return False

    print("\n3. Checking limit status for all motors...")
    try:
        limit_status = mc.check_all_limits()
        for motor, status in limit_status.items():
            violation = "NONE" if status.violation_type == 0 else str(status.violation_type)
            warning = " ⚠️ WARNING ZONE" if status.in_warning_zone else ""
            print(f"   {motor}: {violation}{warning}")
            if status.message:
                print(f"      {status.message}")
        print("  ✅ PASS: Limit status checked successfully")
        return True
    except Exception as e:
        print(f"  ❌ FAIL: Error checking limits - {e}")
        return False


def test_safe_vs_unsafe_moves(mc: MotorController):
    """Test difference between safe and unsafe moves."""
    print("\n" + "="*60)
    print("TEST 6: Safe vs Unsafe Move Modes")
    print("="*60)

    print("\n1. Testing safe move (with validation)...")
    try:
        mc.move_elevation(95.0, rpm=400, safe=True)  # Should be rejected
        print("  ❌ FAIL: Invalid move was accepted!")
        return False
    except ValueError:
        print("  ✅ PASS: Invalid move rejected with safe=True")

    print("\n2. Testing unsafe move (bypassing validation)...")
    print("   ⚠️  WARNING: Unsafe move would normally go through!")
    print("   (Not executing to avoid damaging hardware)")
    print("  ℹ️  INFO: In production, use safe=False only when necessary")

    return True


def main():
    """Run all tests."""
    print("="*60)
    print("MOTOR LIMIT PROTECTION SYSTEM - TEST SUITE")
    print("="*60)

    port = input("\nEnter serial port (default: /dev/rs485): ").strip()
    if not port:
        port = "/dev/rs485"

    print(f"\nConnecting to motors on {port}...")

    try:
        mc = MotorController(port=port, enable_protection=True)
        print("✅ Connected successfully")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        return 1

    try:
        print("\nInitializing motors...")
        results = mc.initialize_all()
        for motor, success in results.items():
            status = "✅" if success else "❌"
            print(f"  {status} {motor}")

        print("\nEnabling motors...")
        mc.enable_all(True)
        time.sleep(0.5)

        # Run tests
        test_results = {}

        test_results["Software Limits"] = test_software_limits(mc)
        time.sleep(1.0)

        test_results["Warning Zones"] = test_warning_zones(mc)
        time.sleep(1.0)

        test_results["Hardware Limits"] = test_hardware_limits(mc)
        time.sleep(1.0)

        test_results["Position Reading"] = test_current_position_reading(mc)
        time.sleep(1.0)

        test_results["Safe vs Unsafe"] = test_safe_vs_unsafe_moves(mc)
        time.sleep(1.0)

        # Stall detection test (manual)
        response = input("\nRun manual stall detection test? (y/n): ")
        if response.lower() == 'y':
            test_results["Stall Detection"] = test_stall_detection(mc)

        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)

        passed = sum(1 for result in test_results.values() if result is True)
        failed = sum(1 for result in test_results.values() if result is False)
        skipped = sum(1 for result in test_results.values() if result is None)

        for test_name, result in test_results.items():
            if result is True:
                print(f"✅ {test_name}: PASS")
            elif result is False:
                print(f"❌ {test_name}: FAIL")
            else:
                print(f"⚠️  {test_name}: SKIPPED")

        print(f"\nTotal: {passed} passed, {failed} failed, {skipped} skipped")

        # Emergency stop before exit
        print("\nStopping all motors...")
        mc.emergency_stop_all()

        return 0 if failed == 0 else 1

    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        mc.emergency_stop_all()
        return 1
    except Exception as e:
        print(f"\n\n❌ Test error: {e}")
        import traceback
        traceback.print_exc()
        try:
            mc.emergency_stop_all()
        except:
            pass
        return 1
    finally:
        try:
            mc.close()
            print("Connection closed")
        except:
            pass


if __name__ == "__main__":
    sys.exit(main())
