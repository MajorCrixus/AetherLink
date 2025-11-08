"""
Continuous Tracking Controller for MKS Servos

Implements hybrid control strategy:
- Speed mode for continuous tracking (eliminates jitter)
- Position mode for precise holding
- Dynamic parameter adjustment based on real-time feedback
- High-frequency telemetry monitoring
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class TrackingMode(Enum):
    """Servo tracking modes"""
    IDLE = "idle"           # Not tracking, servo disabled
    HOLD = "hold"           # Position hold mode, minimal movement
    TRACK_SPEED = "track_speed"  # Continuous speed tracking
    TRACK_POSITION = "track_position"  # Position tracking with updates
    CORRECTING = "correcting"  # Error correction mode


class AxisTrackingState:
    """State tracker for a single axis"""

    def __init__(self, axis: str, addr: int):
        self.axis = axis
        self.addr = addr
        self.mode = TrackingMode.IDLE

        # Targets
        self.target_deg: float = 0.0
        self.target_velocity_dps: float = 0.0  # degrees per second

        # Current state
        self.actual_deg: float = 0.0
        self.actual_velocity_dps: float = 0.0
        self.error_deg: float = 0.0

        # History for derivative calculation
        self.last_position: Optional[float] = None
        self.last_timestamp: Optional[float] = None

        # Control parameters
        self.speed_rpm: int = 0
        self.current_ma: int = 1600  # Default work current
        self.hold_current_pct: int = 50

        # Thresholds for mode switching
        self.TRACK_ERROR_THRESHOLD = 2.0  # degrees - switch to speed mode above this
        self.HOLD_ERROR_THRESHOLD = 0.5   # degrees - switch to hold mode below this
        self.VELOCITY_THRESHOLD = 0.1     # dps - consider stopped below this

        # Protection
        self.protection_enabled = True
        self.max_error_for_protection = 10.0  # degrees

    def update_actual(self, position_deg: float, timestamp: float):
        """Update actual position and calculate velocity"""
        self.actual_deg = position_deg

        if self.last_position is not None and self.last_timestamp is not None:
            dt = timestamp - self.last_timestamp
            if dt > 0:
                self.actual_velocity_dps = (position_deg - self.last_position) / dt

        self.last_position = position_deg
        self.last_timestamp = timestamp

    def update_target(self, target_deg: float, target_velocity_dps: float = 0.0):
        """Update target position and velocity"""
        self.target_deg = target_deg
        self.target_velocity_dps = target_velocity_dps
        self.error_deg = target_deg - self.actual_deg

    def calculate_control_speed(self) -> Tuple[bool, int]:
        """
        Calculate control speed based on error and target velocity

        Returns:
            (dir_ccw, speed_rpm)
        """
        # Error-based component (proportional control)
        K_P = 10.0  # RPM per degree of error
        error_component = self.error_deg * K_P

        # Velocity feedforward component (convert dps to rpm)
        # 360 deg/rev, so dps * (1/360) = rev/s, * 60 = rpm
        velocity_component = self.target_velocity_dps * (60.0 / 360.0)

        # Combine
        total_rpm = error_component + velocity_component

        # Direction
        dir_ccw = total_rpm > 0
        speed_rpm = min(abs(int(total_rpm)), 3000)  # Cap at max speed

        return dir_ccw, speed_rpm

    def determine_mode(self) -> TrackingMode:
        """
        Determine optimal tracking mode based on current state
        """
        abs_error = abs(self.error_deg)
        abs_target_vel = abs(self.target_velocity_dps)
        abs_actual_vel = abs(self.actual_velocity_dps)

        # Large error - use speed mode for fast correction
        if abs_error > self.TRACK_ERROR_THRESHOLD:
            return TrackingMode.TRACK_SPEED

        # Target is moving - use speed mode
        if abs_target_vel > self.VELOCITY_THRESHOLD:
            return TrackingMode.TRACK_SPEED

        # Small error, target stopped, but we're still moving - correcting
        if abs_error > self.HOLD_ERROR_THRESHOLD and abs_actual_vel > self.VELOCITY_THRESHOLD:
            return TrackingMode.CORRECTING

        # Small error, everything stopped - hold mode
        if abs_error <= self.HOLD_ERROR_THRESHOLD and abs_actual_vel <= self.VELOCITY_THRESHOLD:
            return TrackingMode.HOLD

        # Default to position tracking
        return TrackingMode.TRACK_POSITION


class TrackingController:
    """
    High-performance continuous tracking controller
    """

    def __init__(self, servo_bus, bus_lock):
        self.servo_bus = servo_bus
        self.bus_lock = bus_lock
        self.axes: Dict[str, AxisTrackingState] = {}
        self.running = False
        self.update_rate_hz = 50  # 50 Hz update rate (20ms interval)

    def add_axis(self, axis: str, addr: int):
        """Add an axis to track"""
        self.axes[axis] = AxisTrackingState(axis, addr)

    async def start(self):
        """Start the tracking controller"""
        self.running = True
        asyncio.create_task(self._tracking_loop())
        logger.info("Tracking controller started")

    async def stop(self):
        """Stop the tracking controller"""
        self.running = False
        # Stop all axes
        for axis_state in self.axes.values():
            try:
                async with self.bus_lock:
                    await asyncio.to_thread(
                        self.servo_bus.stop_speed_mode, axis_state.addr, 100
                    )
            except Exception as e:
                logger.error(f"Error stopping {axis_state.axis}: {e}")
        logger.info("Tracking controller stopped")

    async def set_target(self, axis: str, target_deg: float, velocity_dps: float = 0.0):
        """Set target position and velocity for an axis"""
        if axis in self.axes:
            self.axes[axis].update_target(target_deg, velocity_dps)

    async def _tracking_loop(self):
        """Main tracking control loop - runs at high frequency"""
        interval = 1.0 / self.update_rate_hz

        while self.running:
            loop_start = asyncio.get_event_loop().time()

            try:
                await self._update_all_axes()
            except Exception as e:
                logger.error(f"Tracking loop error: {e}")

            # Maintain precise timing
            elapsed = asyncio.get_event_loop().time() - loop_start
            sleep_time = max(0, interval - elapsed)
            await asyncio.sleep(sleep_time)

    async def _update_all_axes(self):
        """Update control for all axes"""
        timestamp = datetime.now(timezone.utc).timestamp()

        # Acquire bus lock once for all operations
        async with self.bus_lock:
            for axis_state in self.axes.values():
                try:
                    # Read current position
                    actual_deg = await asyncio.to_thread(
                        self.servo_bus.read_angle_degrees, axis_state.addr
                    )
                    axis_state.update_actual(actual_deg, timestamp)

                    # Determine optimal control mode
                    new_mode = axis_state.determine_mode()

                    # Execute control based on mode
                    if new_mode != axis_state.mode:
                        await self._transition_mode(axis_state, new_mode)
                    else:
                        await self._execute_mode(axis_state)

                    axis_state.mode = new_mode

                except Exception as e:
                    logger.error(f"Error updating {axis_state.axis}: {e}")

    async def _transition_mode(self, axis_state: AxisTrackingState, new_mode: TrackingMode):
        """Handle mode transitions"""
        logger.debug(f"{axis_state.axis}: {axis_state.mode.value} -> {new_mode.value}")

        if new_mode == TrackingMode.TRACK_SPEED:
            # Start speed mode
            dir_ccw, speed_rpm = axis_state.calculate_control_speed()
            if speed_rpm > 0:
                await asyncio.to_thread(
                    self.servo_bus.run_speed_mode,
                    axis_state.addr, dir_ccw, speed_rpm, 100
                )
                axis_state.speed_rpm = speed_rpm

        elif new_mode == TrackingMode.HOLD:
            # Stop and hold
            await asyncio.to_thread(
                self.servo_bus.stop_speed_mode, axis_state.addr, 50
            )
            axis_state.speed_rpm = 0

        elif new_mode == TrackingMode.IDLE:
            # Stop completely
            await asyncio.to_thread(
                self.servo_bus.emergency_stop, axis_state.addr
            )
            axis_state.speed_rpm = 0

    async def _execute_mode(self, axis_state: AxisTrackingState):
        """Execute control in current mode"""

        if axis_state.mode == TrackingMode.TRACK_SPEED:
            # Update speed based on current error
            dir_ccw, speed_rpm = axis_state.calculate_control_speed()

            # Only send command if speed changed significantly
            if abs(speed_rpm - axis_state.speed_rpm) > 5 or speed_rpm == 0:
                if speed_rpm > 0:
                    await asyncio.to_thread(
                        self.servo_bus.run_speed_mode,
                        axis_state.addr, dir_ccw, speed_rpm, 100
                    )
                else:
                    await asyncio.to_thread(
                        self.servo_bus.stop_speed_mode, axis_state.addr, 50
                    )
                axis_state.speed_rpm = speed_rpm

        elif axis_state.mode == TrackingMode.CORRECTING:
            # Small corrections with position mode
            await asyncio.to_thread(
                self.servo_bus.move_to_degrees,
                axis_state.addr, 10, 50, axis_state.target_deg
            )

        elif axis_state.mode == TrackingMode.HOLD:
            # Just monitor, position controller handles hold
            pass

    def get_state(self, axis: str) -> Optional[Dict]:
        """Get current state for an axis"""
        if axis in self.axes:
            state = self.axes[axis]
            return {
                "mode": state.mode.value,
                "target_deg": state.target_deg,
                "actual_deg": state.actual_deg,
                "error_deg": state.error_deg,
                "target_velocity_dps": state.target_velocity_dps,
                "actual_velocity_dps": state.actual_velocity_dps,
                "speed_rpm": state.speed_rpm
            }
        return None
