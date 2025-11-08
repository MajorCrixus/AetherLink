#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Multi-Motor Controller for Aetherlink Project
----------------------------------------------
Convenience wrapper for controlling three MKS servo motors on shared RS485 bus:
- Azimuth (Servo57D): Address 0x01
- Elevation (Servo57D): Address 0x02
- Cross (Servo42D): Address 0x03

Usage:
    from back_end.hardware.motors.multi_motor_controller import MotorController

    mc = MotorController(port="/dev/rs485")
    mc.enable_all()
    mc.move_azimuth(180.0, rpm=600)
    mc.move_elevation(45.0, rpm=400)
    mc.emergency_stop_all()
"""

from __future__ import annotations
from typing import Dict, Tuple, Optional
from dataclasses import dataclass
from .mks_servo57d_lib import MKSServo57D, Mode, HomeParams, IOFlags
from .limit_protection import LimitProtectionSystem, create_aetherlink_protection, LimitStatus


@dataclass
class MotorConfig:
    """Configuration for a single motor."""
    addr: int
    name: str
    max_rpm: int = 3000
    current_ma: int = 3200
    hold_current_pct: int = 50
    mode: Mode = Mode.SR_vFOC
    default_acc: int = 3


class MotorController:
    """
    High-level controller for three-motor antenna system.

    Attributes:
        azimuth_addr (int): Address for azimuth motor (default 0x01)
        elevation_addr (int): Address for elevation motor (default 0x02)
        cross_addr (int): Address for cross motor (default 0x03)
    """

    def __init__(
        self,
        port: str,
        baud: int = 38400,
        azimuth_addr: int = 0x01,
        elevation_addr: int = 0x02,
        cross_addr: int = 0x03,
        timeout: float = 0.25,
        enable_protection: bool = True
    ):
        """
        Initialize multi-motor controller.

        Args:
            port: Serial port (e.g., "/dev/rs485")
            baud: Baud rate (default 38400)
            azimuth_addr: Azimuth motor address (default 0x01)
            elevation_addr: Elevation motor address (default 0x02)
            cross_addr: Cross motor address (default 0x03)
            timeout: Serial timeout in seconds
            enable_protection: Enable limit protection system (default True)
        """
        self.servo = MKSServo57D(port=port, baud=baud, timeout=timeout)

        self.azimuth = MotorConfig(addr=azimuth_addr, name="Azimuth")
        self.elevation = MotorConfig(addr=elevation_addr, name="Elevation")
        self.cross = MotorConfig(addr=cross_addr, name="Cross")

        self._motors = [self.azimuth, self.elevation, self.cross]

        # Initialize limit protection system
        self.protection: Optional[LimitProtectionSystem] = None
        if enable_protection:
            self.protection = create_aetherlink_protection(self.servo)

    # ===== Initialization & Configuration =====

    def initialize_all(self, current_ma: int = 3200, mode: Mode = Mode.SR_vFOC) -> Dict[str, bool]:
        """
        Initialize all three motors with standard configuration.

        Args:
            current_ma: Operating current in milliamps
            mode: Control mode (default SR_vFOC for serial control)

        Returns:
            Dict mapping motor names to success status
        """
        results = {}
        for motor in self._motors:
            try:
                self.servo.set_mode(motor.addr, mode)
                self.servo.set_current_ma(motor.addr, current_ma)
                self.servo.set_hold_current_percent(motor.addr, 50)
                results[motor.name] = True
            except Exception as e:
                print(f"Failed to initialize {motor.name}: {e}")
                results[motor.name] = False
        return results

    def enable_all(self, enable: bool = True) -> Dict[str, int]:
        """Enable or disable all motors."""
        return {
            motor.name: self.servo.enable(motor.addr, enable)
            for motor in self._motors
        }

    def emergency_stop_all(self) -> Dict[str, int]:
        """Emergency stop all motors immediately."""
        return {
            motor.name: self.servo.emergency_stop(motor.addr)
            for motor in self._motors
        }

    # ===== Individual Motor Control =====

    def move_azimuth(self, target_deg: float, rpm: int = 600, acc: int = 3, safe: bool = True) -> int:
        """
        Move azimuth motor to absolute angle (degrees).

        Args:
            target_deg: Target angle in degrees
            rpm: Speed in RPM
            acc: Acceleration value
            safe: Use limit protection validation (default True)
        """
        if safe and self.protection:
            success, msg = self.protection.safe_move_to("azimuth", target_deg, rpm, acc)
            if not success:
                raise ValueError(f"Move rejected: {msg}")
            return 1  # Move initiated
        return self.servo.move_to_degrees(self.azimuth.addr, rpm, acc, target_deg)

    def move_elevation(self, target_deg: float, rpm: int = 400, acc: int = 3, safe: bool = True) -> int:
        """
        Move elevation motor to absolute angle (degrees).

        Args:
            target_deg: Target angle in degrees
            rpm: Speed in RPM
            acc: Acceleration value
            safe: Use limit protection validation (default True)
        """
        if safe and self.protection:
            success, msg = self.protection.safe_move_to("elevation", target_deg, rpm, acc)
            if not success:
                raise ValueError(f"Move rejected: {msg}")
            return 1
        return self.servo.move_to_degrees(self.elevation.addr, rpm, acc, target_deg)

    def move_cross(self, target_deg: float, rpm: int = 300, acc: int = 2, safe: bool = True) -> int:
        """
        Move cross motor to absolute angle (degrees).

        Args:
            target_deg: Target angle in degrees
            rpm: Speed in RPM
            acc: Acceleration value
            safe: Use limit protection validation (default True)
        """
        if safe and self.protection:
            success, msg = self.protection.safe_move_to("cross", target_deg, rpm, acc)
            if not success:
                raise ValueError(f"Move rejected: {msg}")
            return 1
        return self.servo.move_to_degrees(self.cross.addr, rpm, acc, target_deg)

    def move_azimuth_relative(self, degrees: float, rpm: int = 600, acc: int = 3) -> int:
        """Move azimuth motor by relative angle (degrees)."""
        return self.servo.move_relative_degrees(self.azimuth.addr, rpm, acc, degrees)

    def move_elevation_relative(self, degrees: float, rpm: int = 400, acc: int = 3) -> int:
        """Move elevation motor by relative angle (degrees)."""
        return self.servo.move_relative_degrees(self.elevation.addr, rpm, acc, degrees)

    def move_cross_relative(self, degrees: float, rpm: int = 300, acc: int = 2) -> int:
        """Move cross motor by relative angle (degrees)."""
        return self.servo.move_relative_degrees(self.cross.addr, rpm, acc, degrees)

    # ===== Coordinated Motion =====

    def move_to_position(
        self,
        azimuth_deg: Optional[float] = None,
        elevation_deg: Optional[float] = None,
        cross_deg: Optional[float] = None,
        rpm: int = 600,
        acc: int = 3
    ) -> Dict[str, int]:
        """
        Move multiple motors to absolute positions simultaneously.

        Args:
            azimuth_deg: Target azimuth angle (None to skip)
            elevation_deg: Target elevation angle (None to skip)
            cross_deg: Target cross angle (None to skip)
            rpm: Speed for all motors
            acc: Acceleration for all motors

        Returns:
            Dict mapping motor names to command response codes
        """
        results = {}

        if azimuth_deg is not None:
            results["Azimuth"] = self.move_azimuth(azimuth_deg, rpm, acc)

        if elevation_deg is not None:
            results["Elevation"] = self.move_elevation(elevation_deg, rpm, acc)

        if cross_deg is not None:
            results["Cross"] = self.move_cross(cross_deg, rpm, acc)

        return results

    # ===== Status & Monitoring =====

    def read_all_angles(self) -> Dict[str, float]:
        """Read current angles from all motors."""
        return {
            "azimuth": self.servo.read_angle_degrees(self.azimuth.addr),
            "elevation": self.servo.read_angle_degrees(self.elevation.addr),
            "cross": self.servo.read_angle_degrees(self.cross.addr),
        }

    def read_all_speeds(self) -> Dict[str, int]:
        """Read current speeds (RPM) from all motors."""
        return {
            "azimuth": self.servo.read_speed_rpm(self.azimuth.addr),
            "elevation": self.servo.read_speed_rpm(self.elevation.addr),
            "cross": self.servo.read_speed_rpm(self.cross.addr),
        }

    def read_all_status(self) -> Dict[str, int]:
        """Read motion status from all motors."""
        return {
            "azimuth": int(self.servo.query_status(self.azimuth.addr)),
            "elevation": int(self.servo.query_status(self.elevation.addr)),
            "cross": int(self.servo.query_status(self.cross.addr)),
        }

    def read_all_errors(self) -> Dict[str, int]:
        """Read axis errors from all motors."""
        return {
            "azimuth": self.servo.read_axis_error(self.azimuth.addr),
            "elevation": self.servo.read_axis_error(self.elevation.addr),
            "cross": self.servo.read_axis_error(self.cross.addr),
        }

    def get_snapshot(self) -> Dict:
        """Get complete status snapshot of all motors."""
        return {
            "angles": self.read_all_angles(),
            "speeds": self.read_all_speeds(),
            "status": self.read_all_status(),
            "errors": self.read_all_errors(),
        }

    # ===== I/O Control =====

    def read_io(self, motor: str) -> Dict[str, bool]:
        """
        Read I/O pins for specified motor.

        Args:
            motor: "azimuth", "elevation", or "cross"

        Returns:
            Dict with keys: IN1, IN2, OUT1, OUT2
        """
        addr = self._get_addr(motor)
        return self.servo.read_io_normalized(addr)

    def read_limits(self, motor: str) -> Dict[str, bool]:
        """
        Read limit switch states for specified motor.

        Args:
            motor: "azimuth", "elevation", or "cross"

        Returns:
            Dict with keys: in1, in2 (True when pressed)
        """
        addr = self._get_addr(motor)
        return self.servo.read_limits(addr)

    def enable_firmware_limits(self, motor: str, enable: bool = True) -> int:
        """
        Enable/disable firmware limit switch protection.

        Args:
            motor: "azimuth", "elevation", or "cross"
            enable: True to enable limit protection
        """
        addr = self._get_addr(motor)
        return self.servo.enable_firmware_limits(addr, enable)

    # ===== Homing =====

    def home_azimuth(self, speed_rpm: int = 120, direction_ccw: bool = False) -> int:
        """
        Home azimuth motor using limit switch.

        Args:
            speed_rpm: Homing speed
            direction_ccw: True for CCW, False for CW
        """
        params = HomeParams(hm_trig=0, hm_dir=1 if direction_ccw else 0, hm_speed=speed_rpm, end_limit=1)
        self.servo.set_home_params(self.azimuth.addr, params)
        return self.servo.go_home(self.azimuth.addr)

    def home_elevation(self, speed_rpm: int = 120, direction_ccw: bool = False) -> int:
        """Home elevation motor using limit switch."""
        params = HomeParams(hm_trig=0, hm_dir=1 if direction_ccw else 0, hm_speed=speed_rpm, end_limit=1)
        self.servo.set_home_params(self.elevation.addr, params)
        return self.servo.go_home(self.elevation.addr)

    def home_cross(self, speed_rpm: int = 100, direction_ccw: bool = False) -> int:
        """Home cross motor using limit switch."""
        params = HomeParams(hm_trig=0, hm_dir=1 if direction_ccw else 0, hm_speed=speed_rpm, end_limit=1)
        self.servo.set_home_params(self.cross.addr, params)
        return self.servo.go_home(self.cross.addr)

    def zero_all(self) -> Dict[str, int]:
        """Set current position as zero for all motors."""
        return {
            motor.name: self.servo.set_axis_zero(motor.addr)
            for motor in self._motors
        }

    # ===== Limit Protection =====

    def check_all_limits(self) -> Dict[str, LimitStatus]:
        """Check limit status for all motors."""
        if not self.protection:
            return {}
        return self.protection.check_all_motors()

    def check_motor_limits(self, motor: str) -> Optional[LimitStatus]:
        """Check limit status for a specific motor."""
        if not self.protection:
            return None
        return self.protection.check_limits(motor)

    def get_protection_system(self) -> Optional[LimitProtectionSystem]:
        """Get direct access to the protection system."""
        return self.protection

    def update_motor_limits(self, motor: str, **kwargs):
        """
        Update limit configuration for a motor.

        Args:
            motor: Motor name ("azimuth", "elevation", "cross")
            **kwargs: Limit parameters to update (min_angle, max_angle, etc.)

        Example:
            mc.update_motor_limits("elevation", min_angle=5.0, max_angle=85.0)
        """
        if self.protection:
            self.protection.update_motor_limits(motor, **kwargs)

    # ===== Low-Level Access =====

    def get_servo(self) -> MKSServo57D:
        """Get direct access to underlying servo driver for advanced commands."""
        return self.servo

    def _get_addr(self, motor: str) -> int:
        """Helper to convert motor name to address."""
        motor_map = {
            "azimuth": self.azimuth.addr,
            "elevation": self.elevation.addr,
            "cross": self.cross.addr,
        }
        if motor.lower() not in motor_map:
            raise ValueError(f"Unknown motor '{motor}'. Valid: azimuth, elevation, cross")
        return motor_map[motor.lower()]

    # ===== Cleanup =====

    def close(self):
        """Close serial connection."""
        try:
            self.servo.close()
        except Exception:
            pass

    def __enter__(self):
        """Context manager support."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager cleanup."""
        self.close()


# ===== Convenience Functions =====

def create_controller(port: str = "/dev/rs485", baud: int = 38400) -> MotorController:
    """
    Create and initialize a motor controller with default settings.

    Args:
        port: Serial port path
        baud: Baud rate

    Returns:
        Initialized MotorController instance
    """
    mc = MotorController(port=port, baud=baud)
    mc.initialize_all()
    return mc


if __name__ == "__main__":
    # Example usage
    with MotorController("/dev/rs485") as mc:
        print("Initializing motors...")
        mc.initialize_all()

        print("Enabling motors...")
        mc.enable_all(True)

        print("Moving to position...")
        mc.move_to_position(
            azimuth_deg=180.0,
            elevation_deg=45.0,
            cross_deg=90.0,
            rpm=600
        )

        print("Reading positions...")
        print(mc.read_all_angles())

        print("Emergency stop...")
        mc.emergency_stop_all()
