#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor Limit Protection System for Aetherlink Antenna Tracking
--------------------------------------------------------------
Comprehensive limit protection for three motor types:

1. **Azimuth Motor (0x01)**: Hardware limit switches on IN1/IN2
   - Uses firmware-enforced limits (0x9E command)
   - Physical switches prevent over-travel

2. **Elevation Motor (0x02)**: Software limits + stall detection
   - No physical limit switches
   - Min/max angle enforcement in software
   - Stall detection (0x88) for mechanical blockage

3. **Cross Motor (0x03)**: Software limits + stall detection
   - No physical limit switches
   - Min/max angle enforcement in software
   - Stall detection (0x88) for mechanical blockage

Key Features:
- Software limit boundaries with configurable margins
- Stall detection monitoring via protect status (0x3E)
- Position following error detection (0x39 axis error)
- Automatic recovery procedures
- Logging and alert system
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Callable, Dict, List
from enum import IntEnum
import time
import logging

from .mks_servo57d_lib import MKSServo57D, StatusF1


logger = logging.getLogger(__name__)


class LimitViolationType(IntEnum):
    """Types of limit violations."""
    NONE = 0
    SOFTWARE_MIN = 1
    SOFTWARE_MAX = 2
    HARDWARE_LIMIT = 3
    STALL_DETECTED = 4
    POSITION_ERROR = 5
    FOLLOWING_ERROR = 6


class ProtectionAction(IntEnum):
    """Actions to take on limit violation."""
    NONE = 0
    WARN = 1
    STOP = 2
    EMERGENCY_STOP = 3
    REVERSE = 4


@dataclass
class MotorLimits:
    """Limit configuration for a single motor."""
    addr: int
    name: str

    # Software limits (degrees)
    min_angle: Optional[float] = None  # None = no limit
    max_angle: Optional[float] = None  # None = no limit

    # Hardware limits
    has_hardware_limits: bool = False
    hardware_limits_enabled: bool = False

    # Stall detection
    stall_detection_enabled: bool = False
    stall_current_threshold: Optional[int] = None  # mA

    # Position error protection
    max_following_error: int = 500  # axis ticks (default ~11°)
    max_position_error_time_ms: int = 1000

    # Safety margins (degrees from limits before warning)
    warning_margin: float = 5.0

    # Recovery behavior
    recovery_distance: float = 2.0  # degrees to back off on limit hit
    recovery_speed: int = 100  # RPM for recovery moves


@dataclass
class LimitStatus:
    """Current limit status for a motor."""
    violation_type: LimitViolationType = LimitViolationType.NONE
    current_angle: Optional[float] = None
    limit_value: Optional[float] = None
    axis_error: int = 0
    protect_flag: int = 0
    in_warning_zone: bool = False
    message: str = ""


class LimitProtectionSystem:
    """
    Comprehensive limit protection system for multi-motor antenna.

    Monitors and enforces:
    - Hardware limit switches (azimuth)
    - Software angle limits (elevation, cross)
    - Stall detection (elevation, cross)
    - Position following errors (all motors)
    """

    def __init__(self, servo: MKSServo57D, motors: Dict[str, MotorLimits]):
        """
        Initialize protection system.

        Args:
            servo: MKSServo57D driver instance
            motors: Dict mapping motor names to MotorLimits configs
        """
        self.servo = servo
        self.motors = motors
        self._violation_callbacks: List[Callable] = []
        self._enabled = True

        # Initialize protection features on motors
        self._initialize_protection()

    def _initialize_protection(self):
        """Configure protection features on each motor."""
        for name, limits in self.motors.items():
            try:
                # Enable/disable hardware limits
                if limits.has_hardware_limits:
                    self.servo.enable_firmware_limits(limits.addr, limits.hardware_limits_enabled)
                    logger.info(f"{name}: Hardware limits {'enabled' if limits.hardware_limits_enabled else 'disabled'}")

                # Enable/disable stall protection
                self.servo.set_stall_protect(limits.addr, limits.stall_detection_enabled)
                logger.info(f"{name}: Stall detection {'enabled' if limits.stall_detection_enabled else 'disabled'}")

                # Configure position error protection
                if limits.max_following_error > 0:
                    self.servo.set_en_zero_and_pos_protect(
                        limits.addr,
                        en_zero=False,  # Don't auto-zero on EN signal
                        pos_protect=True,  # Enable position error protection
                        trig_time_ms=limits.max_position_error_time_ms,
                        trig_distance_ticks=limits.max_following_error
                    )
                    logger.info(f"{name}: Position error protection enabled "
                               f"(max error: {limits.max_following_error} ticks)")

            except Exception as e:
                logger.error(f"Failed to initialize protection for {name}: {e}")

    def check_limits(self, motor_name: str) -> LimitStatus:
        """
        Check all limit conditions for a motor.

        Args:
            motor_name: Name of motor to check

        Returns:
            LimitStatus with current violation status
        """
        if not self._enabled:
            return LimitStatus()

        if motor_name not in self.motors:
            return LimitStatus(
                violation_type=LimitViolationType.NONE,
                message=f"Unknown motor: {motor_name}"
            )

        limits = self.motors[motor_name]
        status = LimitStatus()

        try:
            # Read current position
            current_angle = self.servo.read_angle_degrees(limits.addr)
            status.current_angle = current_angle

            # Check software limits
            if limits.min_angle is not None and current_angle < limits.min_angle:
                status.violation_type = LimitViolationType.SOFTWARE_MIN
                status.limit_value = limits.min_angle
                status.message = f"{motor_name} below minimum: {current_angle:.1f}° < {limits.min_angle:.1f}°"
                return status

            if limits.max_angle is not None and current_angle > limits.max_angle:
                status.violation_type = LimitViolationType.SOFTWARE_MAX
                status.limit_value = limits.max_angle
                status.message = f"{motor_name} above maximum: {current_angle:.1f}° > {limits.max_angle:.1f}°"
                return status

            # Check warning zones
            if limits.min_angle is not None:
                if current_angle < limits.min_angle + limits.warning_margin:
                    status.in_warning_zone = True
                    status.message = f"{motor_name} approaching minimum limit"

            if limits.max_angle is not None:
                if current_angle > limits.max_angle - limits.warning_margin:
                    status.in_warning_zone = True
                    status.message = f"{motor_name} approaching maximum limit"

            # Check hardware limits (if applicable)
            if limits.has_hardware_limits:
                limit_switches = self.servo.read_limits(limits.addr)
                if limit_switches.get("in1", False) or limit_switches.get("in2", False):
                    status.violation_type = LimitViolationType.HARDWARE_LIMIT
                    status.message = f"{motor_name} hardware limit switch triggered"
                    return status

            # Check stall/protection status
            protect_flag = self.servo.read_protect_status(limits.addr)
            status.protect_flag = protect_flag
            if protect_flag != 0:  # 0 = protected/stalled, 1 = normal
                status.violation_type = LimitViolationType.STALL_DETECTED
                status.message = f"{motor_name} stall protection triggered (flag: {protect_flag})"
                return status

            # Check position following error
            axis_error = self.servo.read_axis_error(limits.addr)
            status.axis_error = axis_error
            if abs(axis_error) > limits.max_following_error:
                status.violation_type = LimitViolationType.FOLLOWING_ERROR
                status.message = f"{motor_name} following error too large: {axis_error} ticks"
                return status

        except Exception as e:
            logger.error(f"Error checking limits for {motor_name}: {e}")
            status.message = f"Error checking limits: {e}"

        return status

    def check_all_motors(self) -> Dict[str, LimitStatus]:
        """Check limits for all motors."""
        return {name: self.check_limits(name) for name in self.motors.keys()}

    def validate_move(self, motor_name: str, target_angle: float) -> tuple[bool, str]:
        """
        Validate if a move to target angle is safe.

        Args:
            motor_name: Name of motor
            target_angle: Desired target angle (degrees)

        Returns:
            (is_safe, reason) - True if move is safe, False with reason if not
        """
        if motor_name not in self.motors:
            return False, f"Unknown motor: {motor_name}"

        limits = self.motors[motor_name]

        # Check software limits
        if limits.min_angle is not None and target_angle < limits.min_angle:
            return False, f"Target {target_angle:.1f}° below minimum {limits.min_angle:.1f}°"

        if limits.max_angle is not None and target_angle > limits.max_angle:
            return False, f"Target {target_angle:.1f}° above maximum {limits.max_angle:.1f}°"

        # Check current limit status
        status = self.check_limits(motor_name)
        if status.violation_type not in [LimitViolationType.NONE]:
            return False, f"Current violation: {status.message}"

        return True, "Move validated"

    def safe_move_to(
        self,
        motor_name: str,
        target_angle: float,
        speed_rpm: int = 600,
        acc: int = 3,
        force: bool = False
    ) -> tuple[bool, str]:
        """
        Perform a safe move with limit validation.

        Args:
            motor_name: Name of motor
            target_angle: Target angle (degrees)
            speed_rpm: Speed in RPM
            acc: Acceleration value
            force: If True, skip validation (use with caution!)

        Returns:
            (success, message)
        """
        if not force:
            is_safe, reason = self.validate_move(motor_name, target_angle)
            if not is_safe:
                logger.warning(f"Move rejected: {reason}")
                return False, reason

        limits = self.motors[motor_name]

        try:
            self.servo.move_to_degrees(limits.addr, speed_rpm, acc, target_angle)
            return True, f"Moving {motor_name} to {target_angle:.1f}°"
        except Exception as e:
            logger.error(f"Move failed for {motor_name}: {e}")
            return False, f"Move failed: {e}"

    def recover_from_limit(self, motor_name: str, status: LimitStatus) -> bool:
        """
        Attempt automatic recovery from limit violation.

        Args:
            motor_name: Name of motor
            status: Current limit status

        Returns:
            True if recovery attempted, False otherwise
        """
        if motor_name not in self.motors:
            return False

        limits = self.motors[motor_name]

        try:
            if status.violation_type == LimitViolationType.STALL_DETECTED:
                # Release stall protection
                logger.info(f"Releasing stall protection on {motor_name}")
                self.servo.release_protect(limits.addr)
                time.sleep(0.1)
                return True

            elif status.violation_type in [LimitViolationType.SOFTWARE_MIN, LimitViolationType.HARDWARE_LIMIT]:
                # Back off from minimum limit
                if status.current_angle is not None:
                    recovery_target = status.current_angle + limits.recovery_distance
                    logger.info(f"Recovering {motor_name}: backing off to {recovery_target:.1f}°")
                    self.servo.move_to_degrees(
                        limits.addr,
                        limits.recovery_speed,
                        acc=2,
                        target_deg=recovery_target
                    )
                    return True

            elif status.violation_type == LimitViolationType.SOFTWARE_MAX:
                # Back off from maximum limit
                if status.current_angle is not None:
                    recovery_target = status.current_angle - limits.recovery_distance
                    logger.info(f"Recovering {motor_name}: backing off to {recovery_target:.1f}°")
                    self.servo.move_to_degrees(
                        limits.addr,
                        limits.recovery_speed,
                        acc=2,
                        target_deg=recovery_target
                    )
                    return True

            elif status.violation_type == LimitViolationType.FOLLOWING_ERROR:
                # Emergency stop and release protection
                logger.warning(f"Following error on {motor_name}: emergency stop")
                self.servo.emergency_stop(limits.addr)
                time.sleep(0.1)
                self.servo.release_protect(limits.addr)
                return True

        except Exception as e:
            logger.error(f"Recovery failed for {motor_name}: {e}")
            return False

        return False

    def emergency_stop_all(self) -> Dict[str, bool]:
        """Emergency stop all motors."""
        results = {}
        for name, limits in self.motors.items():
            try:
                self.servo.emergency_stop(limits.addr)
                results[name] = True
                logger.warning(f"Emergency stop: {name}")
            except Exception as e:
                results[name] = False
                logger.error(f"Emergency stop failed for {name}: {e}")
        return results

    def register_violation_callback(self, callback: Callable[[str, LimitStatus], None]):
        """
        Register callback function to be called on limit violations.

        Args:
            callback: Function taking (motor_name, status) as arguments
        """
        self._violation_callbacks.append(callback)

    def _trigger_callbacks(self, motor_name: str, status: LimitStatus):
        """Trigger all registered violation callbacks."""
        for callback in self._violation_callbacks:
            try:
                callback(motor_name, status)
            except Exception as e:
                logger.error(f"Callback error: {e}")

    def enable(self, enabled: bool = True):
        """Enable or disable protection system."""
        self._enabled = enabled
        logger.info(f"Protection system {'enabled' if enabled else 'disabled'}")

    def get_motor_config(self, motor_name: str) -> Optional[MotorLimits]:
        """Get limit configuration for a motor."""
        return self.motors.get(motor_name)

    def update_motor_limits(self, motor_name: str, **kwargs):
        """
        Update limit configuration for a motor.

        Args:
            motor_name: Name of motor
            **kwargs: Attributes to update (min_angle, max_angle, etc.)
        """
        if motor_name not in self.motors:
            raise ValueError(f"Unknown motor: {motor_name}")

        limits = self.motors[motor_name]
        for key, value in kwargs.items():
            if hasattr(limits, key):
                setattr(limits, key, value)
                logger.info(f"Updated {motor_name}.{key} = {value}")

        # Re-initialize if protection settings changed
        if any(k in kwargs for k in ['stall_detection_enabled', 'hardware_limits_enabled', 'max_following_error']):
            self._initialize_protection()


def create_aetherlink_protection(servo: MKSServo57D) -> LimitProtectionSystem:
    """
    Create protection system with Aetherlink-specific configuration.

    Default configuration:
    - Azimuth (0x01): 0-360° with hardware limits
    - Elevation (0x02): 0-90° with stall detection
    - Cross (0x03): -45 to +45° with stall detection
    """
    motors = {
        "azimuth": MotorLimits(
            addr=0x01,
            name="Azimuth",
            min_angle=0.0,
            max_angle=360.0,
            has_hardware_limits=True,
            hardware_limits_enabled=True,
            stall_detection_enabled=False,  # Has hardware limits
            warning_margin=10.0
        ),
        "elevation": MotorLimits(
            addr=0x02,
            name="Elevation",
            min_angle=0.0,
            max_angle=90.0,
            has_hardware_limits=False,
            stall_detection_enabled=True,  # No hardware limits - use stall detection
            max_following_error=500,  # ~11° following error tolerance
            warning_margin=5.0
        ),
        "cross": MotorLimits(
            addr=0x03,
            name="Cross",
            min_angle=-45.0,
            max_angle=45.0,
            has_hardware_limits=False,
            stall_detection_enabled=True,  # No hardware limits - use stall detection
            max_following_error=400,  # ~8.8° following error tolerance
            warning_margin=5.0
        )
    }

    return LimitProtectionSystem(servo, motors)
