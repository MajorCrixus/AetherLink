"""
Demo mode simulator - generates realistic telemetry data for testing
Implements deterministic simulation with various profiles
"""

import logging
import random
import math
import time
from datetime import datetime, timezone
from typing import Dict, Optional

import psutil

from ..models.telemetry import TelemetryData, GPSFix, IMU, AxisState, ServoState, LimitState, SystemState
from ..core.config import settings

logger = logging.getLogger(__name__)

class DemoSimulator:
    """Generates realistic telemetry data for demo mode"""

    def __init__(self):
        self.running = False
        self.profile = "lab"
        self.start_time = 0
        self.rng = random.Random(42)  # Deterministic seed

        # Simulation state
        self.base_lat = 37.7749  # San Francisco (example)
        self.base_lon = -122.4194
        self.base_alt = 100.0

        # Motion state
        self.az_target = 0.0
        self.el_target = 0.0
        self.cl_target = 0.0
        self.az_actual = 0.0
        self.el_actual = 0.0
        self.cl_actual = 0.0

        # Noise parameters by profile
        self.profiles = {
            "lab": {
                "gps_noise": 0.0001,  # Very stable
                "imu_noise": 0.1,
                "servo_lag": 0.95,    # Quick response
                "limit_trigger_chance": 0.0001
            },
            "windy": {
                "gps_noise": 0.0005,
                "imu_noise": 0.5,     # Wind affecting IMU
                "servo_lag": 0.90,
                "limit_trigger_chance": 0.001
            },
            "noisy-imu": {
                "gps_noise": 0.0002,
                "imu_noise": 2.0,     # Noisy IMU
                "servo_lag": 0.95,
                "limit_trigger_chance": 0.0005
            },
            "urban-gps": {
                "gps_noise": 0.002,   # GPS multipath
                "imu_noise": 0.2,
                "servo_lag": 0.95,
                "limit_trigger_chance": 0.0002
            }
        }

    async def start(self, profile: str = "lab"):
        """Start the simulator with a specific profile"""
        if self.running:
            return

        self.profile = profile
        if profile not in self.profiles:
            logger.warning(f"Unknown profile '{profile}', using 'lab'")
            self.profile = "lab"

        self.start_time = time.time()
        self.running = True

        # Initialize positions
        self.az_target = self.rng.uniform(-30, 30)
        self.el_target = self.rng.uniform(10, 45)
        self.cl_target = self.rng.uniform(-2, 2)

        logger.info(f"Demo simulator started with profile '{self.profile}'")

    async def stop(self):
        """Stop the simulator"""
        self.running = False
        logger.info("Demo simulator stopped")

    async def get_telemetry(self) -> TelemetryData:
        """Generate simulated telemetry data"""
        if not self.running:
            raise RuntimeError("Simulator not running")

        t = time.time() - self.start_time
        profile_params = self.profiles[self.profile]

        # Simulate GPS with drift and noise
        gps_data = self._simulate_gps(t, profile_params)

        # Simulate IMU with noise and movement
        imu_data = self._simulate_imu(t, profile_params)

        # Simulate servo movement toward targets
        axes_data = self._simulate_axes(t, profile_params)

        # Simulate servo status
        servos_data = self._simulate_servos(t, profile_params)

        # Simulate limit switches
        limits_data = self._simulate_limits(t, profile_params)

        # Get real system status
        system_data = self._get_system_status()

        return TelemetryData(
            gps=gps_data,
            imu=imu_data,
            axes=axes_data,
            servos=servos_data,
            limits=limits_data,
            system=system_data,
            selected_satellite=None  # TODO: Add satellite simulation
        )

    def _now(self) -> str:
        """Get current ISO timestamp"""
        return datetime.now(timezone.utc).isoformat()

    def _simulate_gps(self, t: float, params: Dict) -> GPSFix:
        """Simulate GPS data with realistic drift and noise"""
        # GPS usually has good fix in simulation
        mode = '3D'
        sats = int(8 + 4 * math.sin(t * 0.1)) # 4-12 satellites

        # Add noise and slow drift
        noise = params["gps_noise"]
        lat = self.base_lat + noise * self.rng.gauss(0, 1) + 0.00001 * math.sin(t * 0.01)
        lon = self.base_lon + noise * self.rng.gauss(0, 1) + 0.00001 * math.cos(t * 0.01)
        alt = self.base_alt + 5 * self.rng.gauss(0, 1)

        # HDOP varies realistically
        hdop = 1.0 + 0.5 * abs(math.sin(t * 0.05))

        # Simulate occasional loss of fix
        if self.rng.random() < 0.001:  # Very rare
            mode = '2D'
            hdop *= 2

        return GPSFix(
            mode=mode,
            hdop=hdop,
            pdop=hdop * 1.2,
            lat=lat,
            lon=lon,
            alt_m=alt,
            speed_mps=0.1 * abs(math.sin(t * 0.1)),  # Small movement
            course_deg=90 + 30 * math.sin(t * 0.02),
            sats=sats,
            ts=self._now()
        )

    def _simulate_imu(self, t: float, params: Dict) -> IMU:
        """Simulate IMU data with noise and environmental effects"""
        noise = params["imu_noise"]

        # Base attitude with slow drift and wind effects
        roll = 2 * math.sin(t * 0.1) + noise * self.rng.gauss(0, 1)
        pitch = 1 * math.cos(t * 0.15) + noise * self.rng.gauss(0, 1)
        yaw = 180 + 5 * math.sin(t * 0.05) + noise * self.rng.gauss(0, 1)

        # Temperature simulation
        temp = 25 + 10 * math.sin(t * 0.001) + self.rng.gauss(0, 2)

        return IMU(
            roll_deg=roll,
            pitch_deg=pitch,
            yaw_deg=yaw,
            temp_c=temp,
            ts=self._now()
        )

    def _simulate_axes(self, t: float, params: Dict) -> Dict[str, AxisState]:
        """Simulate axis positions moving toward targets"""
        lag_factor = params["servo_lag"]

        # Update actual positions toward targets with lag
        self.az_actual = self.az_actual * lag_factor + self.az_target * (1 - lag_factor)
        self.el_actual = self.el_actual * lag_factor + self.el_target * (1 - lag_factor)
        self.cl_actual = self.cl_actual * lag_factor + self.cl_target * (1 - lag_factor)

        # Add small amount of noise
        az_noise = 0.1 * self.rng.gauss(0, 1)
        el_noise = 0.1 * self.rng.gauss(0, 1)
        cl_noise = 0.05 * self.rng.gauss(0, 1)

        # Occasionally update targets (automatic tracking simulation)
        if self.rng.random() < 0.002:  # Change target rarely
            self.az_target += self.rng.uniform(-5, 5)
            self.az_target = max(settings.AZ_MIN, min(settings.AZ_MAX, self.az_target))

        if self.rng.random() < 0.001:
            self.el_target += self.rng.uniform(-2, 2)
            self.el_target = max(settings.EL_MIN, min(settings.EL_MAX, self.el_target))

        now = self._now()

        return {
            "AZ": AxisState(
                target_deg=self.az_target,
                actual_deg=self.az_actual + az_noise,
                error_deg=self.az_target - self.az_actual,
                rate_dps=(self.az_target - self.az_actual) * 0.5,  # Proportional rate
                ts=now
            ),
            "EL": AxisState(
                target_deg=self.el_target,
                actual_deg=self.el_actual + el_noise,
                error_deg=self.el_target - self.el_actual,
                rate_dps=(self.el_target - self.el_actual) * 0.3,
                ts=now
            ),
            "CL": AxisState(
                target_deg=self.cl_target,
                actual_deg=self.cl_actual + cl_noise,
                error_deg=self.cl_target - self.cl_actual,
                rate_dps=(self.cl_target - self.cl_actual) * 0.8,
                ts=now
            )
        }

    def _simulate_servos(self, t: float, params: Dict) -> Dict[str, ServoState]:
        """Simulate servo status and health"""
        now = self._now()

        # Base current draw varies with movement
        base_current = 800  # mA
        movement_current = 200 * abs(math.sin(t * 0.5))

        # Temperature rises with current and ambient
        base_temp = 30 + 15 * math.sin(t * 0.001)  # Slow ambient variation

        return {
            "AZ": ServoState(
                axis="AZ",
                mode="TRACK",
                current_ma=int(base_current + movement_current + self.rng.uniform(-50, 50)),
                temp_c=base_temp + self.rng.uniform(-2, 5),
                error_code=None,
                ts=now
            ),
            "EL": ServoState(
                axis="EL",
                mode="TRACK",
                current_ma=int(base_current + movement_current * 0.8 + self.rng.uniform(-50, 50)),
                temp_c=base_temp + self.rng.uniform(-2, 5),
                error_code=None,
                ts=now
            ),
            "CL": ServoState(
                axis="CL",
                mode="HOLD",
                current_ma=int(base_current * 0.5 + self.rng.uniform(-30, 30)),
                temp_c=base_temp + self.rng.uniform(-2, 3),
                error_code=None,
                ts=now
            )
        }

    def _simulate_limits(self, t: float, params: Dict) -> Dict[str, LimitState]:
        """Simulate limit switch states"""
        now = self._now()
        trigger_chance = params["limit_trigger_chance"]

        # Very rarely trigger limits (simulating near-limit movement)
        az_in1 = self.rng.random() < trigger_chance
        az_in2 = self.rng.random() < trigger_chance

        return {
            "AZ": LimitState(
                in1=az_in1,
                in2=az_in2,
                ts=now
            ),
            "EL": LimitState(
                in1=False,  # Elevation typically uses stall detection, not switches
                in2=None,
                ts=now
            ),
            "CL": LimitState(
                in1=False,
                in2=None,
                ts=now
            )
        }

    def _get_system_status(self) -> SystemState:
        """Get real system status (CPU, memory, etc.)"""
        try:
            cpu_percent = psutil.cpu_percent(interval=None)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')

            # Get temperature if available
            temps = {}
            try:
                temps_data = psutil.sensors_temperatures()
                if 'cpu_thermal' in temps_data:
                    temps['cpu'] = temps_data['cpu_thermal'][0].current
                elif 'coretemp' in temps_data:
                    temps['cpu'] = temps_data['coretemp'][0].current
            except Exception:
                temps['cpu'] = 45.0  # Fallback

            return SystemState(
                cpu=cpu_percent,
                gpu=0.0,  # TODO: Add GPU monitoring if available
                mem=memory.percent,
                disk=disk.percent,
                temps=temps,
                ts=self._now()
            )
        except Exception as e:
            logger.warning(f"Failed to get system status: {e}")
            return SystemState(
                cpu=25.0,
                gpu=0.0,
                mem=45.0,
                disk=60.0,
                temps={'cpu': 45.0},
                ts=self._now()
            )

    def set_targets(self, az: Optional[float] = None, el: Optional[float] = None, cl: Optional[float] = None):
        """Set new target positions (for testing manual control)"""
        if az is not None:
            self.az_target = max(settings.AZ_MIN, min(settings.AZ_MAX, az))
        if el is not None:
            self.el_target = max(settings.EL_MIN, min(settings.EL_MAX, el))
        if cl is not None:
            self.cl_target = max(settings.CL_MIN, min(settings.CL_MAX, cl))