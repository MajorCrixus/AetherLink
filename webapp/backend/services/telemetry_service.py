"""
Telemetry service - collects and streams real-time data from hardware modules
Supports both hardware mode and demo simulation
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from ..core.config import settings
from ..models.telemetry import TelemetryData, HealthStatus, HealthState
from .websocket_manager import WebSocketManager
from .hardware_manager import HardwareManager
from .demo_simulator import DemoSimulator

logger = logging.getLogger(__name__)

class TelemetryService:
    """Main telemetry collection and broadcasting service"""

    def __init__(self, websocket_manager: WebSocketManager):
        self.websocket_manager = websocket_manager
        self.hardware_manager = HardwareManager()
        self.demo_simulator = DemoSimulator()

        self.running = False
        self.demo_mode = settings.DEMO_MODE
        self.rate_hz = settings.TELEMETRY_RATE_HZ
        self.task: Optional[asyncio.Task] = None

        # Current telemetry state
        self.current_telemetry: Optional[TelemetryData] = None
        self.health_status = HealthStatus(
            link=HealthState(status='INIT', message='Starting up', last_update=self._now()),
            gps=HealthState(status='INIT', message='Initializing', last_update=self._now()),
            imu=HealthState(status='INIT', message='Initializing', last_update=self._now()),
            servos=HealthState(status='INIT', message='Initializing', last_update=self._now()),
            limits=HealthState(status='INIT', message='Initializing', last_update=self._now()),
            tle=HealthState(status='OFF', message='No TLE data', last_update=self._now()),
            time=HealthState(status='INIT', message='Syncing time', last_update=self._now()),
            system=HealthState(status='OK', message='Running', last_update=self._now()),
            sim=HealthState(status='SIM' if self.demo_mode else 'OFF', message='Demo mode' if self.demo_mode else 'Hardware mode', last_update=self._now())
        )

    def _now(self) -> str:
        """Get current ISO timestamp"""
        return datetime.now(timezone.utc).isoformat()

    @property
    def is_running(self) -> bool:
        """Check if service is running"""
        return self.running

    async def start(self):
        """Start the telemetry service"""
        if self.running:
            return

        logger.info(f"Starting telemetry service (demo_mode={self.demo_mode}, rate={self.rate_hz}Hz)")

        self.running = True

        # Initialize hardware or demo simulator
        if self.demo_mode:
            await self.demo_simulator.start()
            self.health_status.sim.status = 'SIM'
        else:
            await self.hardware_manager.start()
            self.health_status.sim.status = 'OFF'

        # Start telemetry loop
        self.task = asyncio.create_task(self._telemetry_loop())

        # Update health status
        self.health_status.link.status = 'OK'
        self.health_status.link.message = 'Connected'
        self.health_status.link.last_update = self._now()

        logger.info("Telemetry service started successfully")

    async def stop(self):
        """Stop the telemetry service"""
        if not self.running:
            return

        logger.info("Stopping telemetry service...")

        self.running = False

        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

        # Stop hardware or simulator
        if self.demo_mode:
            await self.demo_simulator.stop()
        else:
            await self.hardware_manager.stop()

        logger.info("Telemetry service stopped")

    async def set_demo_mode(self, enabled: bool, profile: str = "lab"):
        """Switch between demo and hardware mode"""
        if enabled == self.demo_mode:
            return

        logger.info(f"Switching to {'demo' if enabled else 'hardware'} mode")

        # Stop current mode
        if self.demo_mode:
            await self.demo_simulator.stop()
        else:
            await self.hardware_manager.stop()

        # Switch mode
        self.demo_mode = enabled

        # Start new mode
        if self.demo_mode:
            await self.demo_simulator.start(profile)
            self.health_status.sim.status = 'SIM'
            self.health_status.sim.message = f'Demo mode: {profile}'
        else:
            await self.hardware_manager.start()
            self.health_status.sim.status = 'OFF'
            self.health_status.sim.message = 'Hardware mode'

        self.health_status.sim.last_update = self._now()

        # Broadcast mode change
        await self.websocket_manager.broadcast_sim_state({
            "enabled": enabled,
            "profile": profile if enabled else None
        })

    async def _telemetry_loop(self):
        """Main telemetry collection and broadcast loop"""
        interval = 1.0 / self.rate_hz

        while self.running:
            try:
                loop_start = time.time()

                # Collect telemetry data
                if self.demo_mode:
                    telemetry = await self.demo_simulator.get_telemetry()
                else:
                    telemetry = await self.hardware_manager.get_telemetry()

                self.current_telemetry = telemetry

                # Update health status based on telemetry
                self._update_health_status(telemetry)

                # Broadcast telemetry
                telemetry_dict = telemetry.model_dump() if telemetry else {}
                await self.websocket_manager.broadcast_telemetry(telemetry_dict)

                # Also broadcast health status
                health_dict = self.health_status.model_dump()
                await self.websocket_manager.broadcast_to_channel("health", health_dict)

                # Calculate sleep time to maintain rate
                elapsed = time.time() - loop_start
                sleep_time = max(0, interval - elapsed)

                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                else:
                    logger.warning(f"Telemetry loop running behind schedule by {-sleep_time:.3f}s")

            except Exception as e:
                logger.error(f"Error in telemetry loop: {e}", exc_info=True)
                await asyncio.sleep(1.0)  # Prevent tight error loops

    def _update_health_status(self, telemetry: Optional[TelemetryData]):
        """Update health status based on current telemetry"""
        now = self._now()

        if not telemetry:
            return

        # GPS health
        if telemetry.gps.mode == 'NO_FIX':
            self.health_status.gps.status = 'ERROR'
            self.health_status.gps.message = 'No GPS fix'
        elif telemetry.gps.mode == '2D':
            self.health_status.gps.status = 'WARN'
            self.health_status.gps.message = '2D fix only'
        else:  # 3D
            self.health_status.gps.status = 'OK'
            self.health_status.gps.message = f'3D fix, {telemetry.gps.sats or 0} sats'
        self.health_status.gps.last_update = now

        # IMU health (check for reasonable values)
        if (abs(telemetry.imu.roll_deg) > 180 or
            abs(telemetry.imu.pitch_deg) > 90 or
            telemetry.imu.temp_c and telemetry.imu.temp_c > 80):
            self.health_status.imu.status = 'WARN'
            self.health_status.imu.message = 'Unusual readings'
        else:
            self.health_status.imu.status = 'OK'
            self.health_status.imu.message = 'Active'
        self.health_status.imu.last_update = now

        # Servo health
        servo_errors = []
        for axis, servo in telemetry.servos.items():
            if servo.error_code:
                servo_errors.append(f"{axis}:{servo.error_code}")
            if servo.temp_c and servo.temp_c > 70:
                servo_errors.append(f"{axis}:HOT")

        if servo_errors:
            self.health_status.servos.status = 'ERROR'
            self.health_status.servos.message = ', '.join(servo_errors)
        else:
            self.health_status.servos.status = 'OK'
            self.health_status.servos.message = 'All servos OK'
        self.health_status.servos.last_update = now

        # Limits health
        limits_triggered = []
        for axis, limit in telemetry.limits.items():
            if limit.in1 or (limit.in2 is not None and limit.in2):
                limits_triggered.append(axis)

        if limits_triggered:
            self.health_status.limits.status = 'WARN'
            self.health_status.limits.message = f'Triggered: {", ".join(limits_triggered)}'
        else:
            self.health_status.limits.status = 'OK'
            self.health_status.limits.message = 'All clear'
        self.health_status.limits.last_update = now

        # System health
        if telemetry.system.cpu > 90 or telemetry.system.mem > 90:
            self.health_status.system.status = 'WARN'
            self.health_status.system.message = 'High resource usage'
        elif any(temp and temp > 80 for temp in telemetry.system.temps.values()):
            self.health_status.system.status = 'WARN'
            self.health_status.system.message = 'High temperature'
        else:
            self.health_status.system.status = 'OK'
            self.health_status.system.message = f'CPU:{telemetry.system.cpu:.0f}% MEM:{telemetry.system.mem:.0f}%'
        self.health_status.system.last_update = now

    def get_current_telemetry(self) -> Optional[TelemetryData]:
        """Get the most recent telemetry data"""
        return self.current_telemetry

    def get_health_status(self) -> HealthStatus:
        """Get current health status"""
        return self.health_status