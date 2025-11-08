import asyncio
import logging
import threading
from datetime import datetime, timezone
from typing import Optional, Dict
import psutil

from ..core.config import settings
from ..models.telemetry import (
    TelemetryData, GPSFix, IMU, AxisState, ServoState,
    LimitState, SystemState
)
from hardware.gps.code_library.bu353n_gps import BU353NGPS
from hardware.imu.code_library.wt901c import WT901C, PID, Angles, Gyro, Accel
from hardware.servo_motors.code_library.servo57d_api import MKSServo57D
from .tracking_controller import TrackingController

logger = logging.getLogger(__name__)

class HardwareManager:
    def __init__(self):
        self.running = False

        # Hardware instances
        self.gps: Optional[BU353NGPS] = None
        self.imu: Optional[WT901C] = None

        # ONE shared servo object (or keep three, but you must lock – see below)
        self.servo_bus: Optional[MKSServo57D] = None  # single port instance

        # Current state
        self.current_angles = {"AZ": 0.0, "EL": 0.0, "CL": 0.0}
        self.target_angles  = {"AZ": 0.0, "EL": 0.0, "CL": 0.0}

        # For rate calculation
        self._last_sample_ts: Dict[str, float] = {"AZ": 0.0, "EL": 0.0, "CL": 0.0}
        self._last_sample_deg: Dict[str, float] = {"AZ": 0.0, "EL": 0.0, "CL": 0.0}

        # Latest hardware readings
        self.latest_gps_fix = None
        self.latest_imu_angles = None
        self.latest_imu_gyro = None
        self.latest_imu_accel = None

        # Concurrency
        self._imu_lock = threading.Lock()    # IMU callback safety
        self._bus_lock = asyncio.Lock()      # RS-485 bus safety

        # Tracking controller (initialized after servos)
        self.tracking_controller: Optional[TrackingController] = None

        # Movement mode: 'position', 'speed', or 'hybrid'
        self.movement_mode: str = 'position'  # Default to position mode

        # Movement activity tracking (for telemetry pause during movements)
        self._movement_active: bool = False
        self._last_movement_time: float = 0.0

        # Position lock state per axis
        self.axis_locked: Dict[str, bool] = {"AZ": False, "EL": False, "CL": False}

    # ---------- lifecycle ----------

    async def start(self):
        if self.running:
            return
        logger.info("Starting hardware manager...")
        try:
            await self._init_gps()
            await self._init_imu()
            await self._init_servos()

            # Initialize tracking controller (hybrid mode available)
            if self.servo_bus:
                self.tracking_controller = TrackingController(self.servo_bus, self._bus_lock)
                self.tracking_controller.add_axis("AZ", settings.SERVO_AZ_ADDR)
                self.tracking_controller.add_axis("EL", settings.SERVO_EL_ADDR)
                self.tracking_controller.add_axis("CL", settings.SERVO_CL_ADDR)
                # Don't start the tracking loop yet - will be started when hybrid mode is selected
                logger.info("Tracking controller initialized (hybrid mode available)")

            self.running = True
            logger.info("Hardware manager started")
        except Exception as e:
            logger.error(f"Failed to start hardware manager: {e}", exc_info=True)
            await self.stop()
            raise

    async def stop(self):
        if not self.running:
            return
        self.running = False  # stop early to prevent new calls
        logger.info("Stopping hardware manager...")
        try:
            if self.gps:
                await asyncio.to_thread(self.gps.stop)
        except Exception as e:
            logger.error(f"Error stopping GPS: {e}")
        try:
            if self.imu:
                await asyncio.to_thread(self.imu.stop)
                await asyncio.to_thread(self.imu.close)
        except Exception as e:
            logger.error(f"Error stopping IMU: {e}")
        try:
            if self.servo_bus:
                await asyncio.to_thread(self.servo_bus.close)
        except Exception as e:
            logger.error(f"Error closing servo bus: {e}")
        logger.info("Hardware manager stopped")

    # ---------- init modules ----------

    async def _init_gps(self):
        try:
            gps_port = settings.GPS_PORT
            logger.info(f"Initializing GPS on {gps_port}")
            self.gps = BU353NGPS(port=gps_port, baud=4800)

            # autobaud can block -> run in thread
            detection = await asyncio.to_thread(
                self.gps.autobaud, [gps_port], [4800, 9600], 3.0
            )
            if detection:
                port, baud, mode = detection
                logger.info(f"GPS detected: {port} @ {baud} baud, mode: {mode}")
                self.gps.baud = baud
            else:
                logger.warning("GPS auto-detection failed, using defaults (4800 baud)")

            await asyncio.to_thread(self.gps.start)
            logger.info("BU-353N GPS started successfully")
        except Exception as e:
            logger.error(f"Failed to initialize GPS: {e}", exc_info=True)
            self.gps = None

    async def _init_imu(self):
        try:
            imu_port = settings.IMU_PORT
            logger.info(f"Initializing IMU on {imu_port}")
            baud_rates = [9600, 115200]
            for baud in baud_rates:
                try:
                    logger.info(f"Trying IMU at {baud} baud…")
                    self.imu = WT901C(port=imu_port, baud=baud)

                    def imu_callback(pid, packet):
                        with self._imu_lock:
                            if pid == PID.ANG and isinstance(packet, Angles):
                                self.latest_imu_angles = packet
                            elif pid == PID.GYRO and isinstance(packet, Gyro):
                                self.latest_imu_gyro = packet
                            elif pid == PID.ACC and isinstance(packet, Accel):
                                self.latest_imu_accel = packet

                    self.imu.on_packet(imu_callback)
                    await asyncio.to_thread(self.imu.start)
                    await asyncio.sleep(1.0)  # non-blocking wait

                    with self._imu_lock:
                        ok = self.latest_imu_angles is not None
                    if ok:
                        logger.info(f"IMU connected at {baud} baud")
                        break
                    else:
                        logger.warning(f"No IMU data at {baud} baud")
                        await asyncio.to_thread(self.imu.stop)
                        await asyncio.to_thread(self.imu.close)
                        self.imu = None
                except Exception as e:
                    logger.warning(f"IMU init failed at {baud}: {e}")
                    if self.imu:
                        try:
                            await asyncio.to_thread(self.imu.stop)
                            await asyncio.to_thread(self.imu.close)
                        except Exception:
                            pass
                        self.imu = None
            if not self.imu:
                logger.error("Failed to initialize IMU at any baud")
        except Exception as e:
            logger.error(f"Failed to initialize IMU: {e}", exc_info=True)
            self.imu = None

    async def _init_servos(self):
        try:
            rs485_port = settings.RS485_PORT
            logger.info(f"Initializing servos on {rs485_port}")
            # ONE bus instance; address selects which servo
            self.servo_bus = MKSServo57D(port=rs485_port, baud=38400)

            async with self._bus_lock:
                # Graceful initialization: only read position, don't change state
                # This prevents servos from moving/jerking when webapp restarts
                for addr, name in [
                    (settings.SERVO_AZ_ADDR, "AZ"),
                    (settings.SERVO_EL_ADDR, "EL"),
                    (settings.SERVO_CL_ADDR, "CL"),
                ]:
                    try:
                        # Only read current position - don't enable or change mode
                        # Servos should already be configured from previous session
                        # or can be configured manually via Servo Console page
                        angle = await asyncio.to_thread(self.servo_bus.read_angle_degrees, addr)
                        self.current_angles[name] = self.target_angles[name] = float(angle)
                        logger.info(f"Servo {name} (addr {addr}): {angle:.1f}° (graceful init - no state change)")
                    except Exception as e:
                        logger.warning(f"Servo {name} init failed (continuing anyway): {e}")
                        # Set default angle if read fails
                        self.current_angles[name] = self.target_angles[name] = 0.0

            logger.info("Servos initialized gracefully - no enable/mode commands sent")
        except Exception as e:
            logger.error(f"Failed to initialize servos: {e}", exc_info=True)
            self.servo_bus = None

    # ---------- telemetry ----------

    async def get_telemetry(self) -> TelemetryData:
        if not self.running:
            raise RuntimeError("Hardware manager not running")
        now = self._now_z()

        gps_data  = self._get_gps_telemetry(now)
        imu_data  = self._get_imu_telemetry(now)
        axes, servos, limits = await self._get_servo_telemetry(now)
        system    = self._get_system_telemetry(now)

        return TelemetryData(
            timestamp=now,               # <-- ensure top-level timestamp
            gps=gps_data,
            imu=imu_data,
            axes=axes,
            servos=servos,
            limits=limits,
            system=system,
            selected_satellite=None,
        )

    def _now_z(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def _get_gps_telemetry(self, timestamp: str) -> GPSFix:
        if not self.gps:
            return GPSFix(mode='NO_FIX', ts=timestamp)
        try:
            fix = self.gps.get_latest_fix()  # likely thread-safe
            mode = '3D' if fix.get('fix', 0) >= 2 else ('2D' if fix.get('fix', 0) == 1 else 'NO_FIX')
            return GPSFix(
                mode=mode,
                hdop=fix.get('hdop'),
                pdop=None,
                lat=fix.get('lat'),
                lon=fix.get('lon'),
                alt_m=fix.get('alt_m'),
                speed_mps=fix.get('speed_mps'),
                course_deg=fix.get('course_deg'),
                sats=fix.get('sats', 0),
                ts=timestamp
            )
        except Exception as e:
            logger.error(f"Error reading GPS: {e}")
            return GPSFix(mode='NO_FIX', ts=timestamp)

    def _get_imu_telemetry(self, timestamp: str) -> IMU:
        with self._imu_lock:
            angles = self.latest_imu_angles
            gyro = self.latest_imu_gyro
            accel = self.latest_imu_accel
        if not angles:
            return IMU(roll_deg=0.0, pitch_deg=0.0, yaw_deg=0.0, ts=timestamp)
        try:
            # Get tilt-compensated orientation if IMU instance is available
            orientation = None
            if self.imu:
                try:
                    orientation = self.imu.get_orientation()
                except Exception as e:
                    logger.debug(f"Could not get IMU orientation: {e}")

            return IMU(
                roll_deg=angles.roll_deg,
                pitch_deg=angles.pitch_deg,
                yaw_deg=angles.yaw_deg,
                gyro_x=getattr(gyro, "gx_dps", None) if gyro else None,
                gyro_y=getattr(gyro, "gy_dps", None) if gyro else None,
                gyro_z=getattr(gyro, "gz_dps", None) if gyro else None,
                accel_x=getattr(accel, "ax_g", None) if accel else None,
                accel_y=getattr(accel, "ay_g", None) if accel else None,
                accel_z=getattr(accel, "az_g", None) if accel else None,
                temp_c=getattr(angles, "temp_c", None),
                # Add orientation fields
                heading_mag_deg=orientation.heading_mag_deg if orientation else None,
                heading_true_deg=orientation.heading_true_deg if orientation else None,
                cross_level_deg=orientation.cross_level_deg if orientation else None,
                elevation_deg=orientation.elevation_deg if orientation else None,
                declination_deg=orientation.declination_deg if orientation else None,
                heading_offset_deg=orientation.heading_offset_deg if orientation else None,
                ts=timestamp
            )
        except Exception as e:
            logger.error(f"Error reading IMU: {e}")
            return IMU(roll_deg=0.0, pitch_deg=0.0, yaw_deg=0.0, ts=timestamp)

    async def _get_servo_telemetry(self, timestamp: str):
        axes_data: Dict[str, AxisState] = {}
        servos_data: Dict[str, ServoState] = {}
        limits_data: Dict[str, LimitState] = {}

        if not self.servo_bus:
            # Provide complete shapes with defaults
            for axis in ("AZ","EL","CL"):
                axes_data[axis] = AxisState(
                    target_deg=self.target_angles[axis],
                    actual_deg=self.current_angles[axis],
                    error_deg=0.0,
                    rate_dps=0.0,
                    ts=timestamp,
                )
                servos_data[axis] = ServoState(
                    axis=axis, mode="IDLE", current_ma=None, temp_c=None, error_code=None, ts=timestamp
                )
                limits_data[axis] = LimitState(in1=False, in2=None, ts=timestamp)
            return axes_data, servos_data, limits_data

        # Check if manual movement is active - if so, skip RS-485 reads to reduce bus contention
        if self.is_movement_active():
            # Return cached values during movement
            for axis in ("AZ","EL","CL"):
                axes_data[axis] = AxisState(
                    target_deg=self.target_angles[axis],
                    actual_deg=self.current_angles[axis],
                    error_deg=self.target_angles[axis] - self.current_angles[axis],
                    rate_dps=0.0,  # Can't calculate rate without new reading
                    ts=timestamp,
                )
                servos_data[axis] = ServoState(
                    axis=axis, mode="MOVING", current_ma=None, temp_c=None, error_code=None, ts=timestamp
                )
                limits_data[axis] = LimitState(in1=False, in2=None, ts=timestamp)
            return axes_data, servos_data, limits_data

        async with self._bus_lock:
            for addr, axis in [
                (settings.SERVO_AZ_ADDR, "AZ"),
                (settings.SERVO_EL_ADDR, "EL"),
                (settings.SERVO_CL_ADDR, "CL"),
            ]:
                try:
                    actual_deg = await asyncio.to_thread(self.servo_bus.read_angle_degrees, addr)
                    target_deg = float(self.target_angles[axis])
                    # rate estimate
                    now_s = datetime.now(timezone.utc).timestamp()
                    last_s = self._last_sample_ts[axis]
                    last_deg = self._last_sample_deg[axis]
                    rate = (actual_deg - last_deg) / (now_s - last_s) if last_s else 0.0
                    self._last_sample_ts[axis] = now_s
                    self._last_sample_deg[axis] = float(actual_deg)

                    # IO / limits (best effort)
                    in1 = False; in2 = None
                    try:
                        io_flags = await asyncio.to_thread(self.servo_bus.read_io, addr)
                        in1 = bool(io_flags & 1)
                        in2 = bool(io_flags & 2)
                    except Exception:
                        pass

                    # Protection status (0x3E: 0=OK, 1=Protected/Stalled)
                    error_code = None
                    try:
                        protect_status = await asyncio.to_thread(self.servo_bus.read_protect_status, addr)
                        if protect_status == 1:
                            error_code = "PROTECTED"
                        elif protect_status != 0:
                            error_code = f"PROTECT_STATUS_{protect_status}"
                    except Exception:
                        pass

                    self.current_angles[axis] = float(actual_deg)
                    axes_data[axis] = AxisState(
                        target_deg=target_deg,
                        actual_deg=float(actual_deg),
                        error_deg=target_deg - float(actual_deg),
                        rate_dps=float(rate),
                        ts=timestamp,
                    )
                    servos_data[axis] = ServoState(
                        axis=axis, mode="HOLD", current_ma=None, temp_c=None, error_code=error_code, ts=timestamp
                    )
                    limits_data[axis] = LimitState(in1=in1, in2=in2, ts=timestamp)

                except Exception as e:
                    logger.error(f"Error reading servo {axis}: {e}")
                    axes_data[axis] = AxisState(
                        target_deg=self.target_angles[axis],
                        actual_deg=self.current_angles[axis],
                        error_deg=0.0,
                        rate_dps=0.0,
                        ts=timestamp,
                    )
                    servos_data[axis] = ServoState(
                        axis=axis, mode="IDLE", current_ma=None, temp_c=None, error_code=str(e)[:50], ts=timestamp
                    )
                    limits_data[axis] = LimitState(in1=False, in2=None, ts=timestamp)

        return axes_data, servos_data, limits_data

    def _get_system_telemetry(self, timestamp: str) -> SystemState:
        try:
            cpu_percent = psutil.cpu_percent(interval=None)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            temps = {}
            try:
                t = psutil.sensors_temperatures()
                for key in ("cpu_thermal", "coretemp", "soc_thermal", "cpu-thermal", "thermal_zone0"):
                    if key in t and t[key]:
                        temps["cpu"] = t[key][0].current
                        break
            except Exception:
                pass
            return SystemState(cpu=cpu_percent, gpu=0.0, mem=memory.percent, disk=disk.percent, temps=temps, ts=timestamp)
        except Exception as e:
            logger.error(f"Error reading system status: {e}")
            return SystemState(cpu=0.0, gpu=0.0, mem=0.0, disk=0.0, temps={}, ts=timestamp)

    async def move_servo(self, axis: str, target_deg: float, speed_rpm: int = 20) -> bool:
        if not self.running or not self.servo_bus:
            return False
        axis = axis.upper()
        if axis not in ("AZ","EL","CL"):
            return False

        limits = {
            "AZ": (settings.AZ_MIN, settings.AZ_MAX),
            "EL": (settings.EL_MIN, settings.EL_MAX),
            "CL": (settings.CL_MIN, settings.CL_MAX),
        }
        min_deg, max_deg = limits[axis]
        if not (min_deg <= target_deg <= max_deg):
            logger.warning(f"Target {target_deg}° for {axis} outside limits ({min_deg}..{max_deg})")
            return False

        addr = {
            "AZ": settings.SERVO_AZ_ADDR,
            "EL": settings.SERVO_EL_ADDR,
            "CL": settings.SERVO_CL_ADDR,
        }[axis]

        try:
            # Update movement activity tracking
            self._movement_active = True
            self._last_movement_time = datetime.now(timezone.utc).timestamp()

            # Route based on movement mode
            if self.movement_mode == 'hybrid':
                # HYBRID MODE DISABLED - causes double-loop oscillation
                # The tracking controller runs an outer position loop while the servo
                # has its own internal position loop, causing fighting/oscillation
                logger.warning(f"[HYBRID] Hybrid mode disabled pending redesign - falling back to position mode")
                # Fall through to position mode
                self.movement_mode = 'position'

            if self.movement_mode == 'speed':
                # Use speed mode for continuous motion without position hold
                current_deg = self.current_angles.get(axis, 0.0)
                error = target_deg - current_deg

                # Ramp up current for movement
                await self._ramp_current(addr, settings.IDLE_CURRENT_MA, settings.WORKING_CURRENT_MA, settings.CURRENT_RAMP_DURATION_MS)

                # Calculate speed and direction based on error
                speed_rpm_calculated = min(abs(int(error * 10)), 3000)  # Proportional speed
                dir_ccw = error > 0

                # Execute speed mode movement
                async with self._bus_lock:
                    await asyncio.to_thread(
                        self.servo_bus.run_speed_mode, addr, dir_ccw, speed_rpm_calculated, settings.DEFAULT_ACCELERATION
                    )
                self.target_angles[axis] = float(target_deg)
                logger.info(f"[SPEED] Moving {axis} to {target_deg:.2f}° @ {speed_rpm_calculated} rpm {'CCW' if dir_ccw else 'CW'}")

                # Stop speed mode (let it coast)
                async with self._bus_lock:
                    await asyncio.to_thread(self.servo_bus.stop_speed_mode, addr, 50)

                # Settle and optionally lock
                await self._settle_and_hold(axis, addr, target_deg)
                return True

            else:  # position mode (default)
                # Ramp up current for movement
                await self._ramp_current(addr, settings.IDLE_CURRENT_MA, settings.WORKING_CURRENT_MA, settings.CURRENT_RAMP_DURATION_MS)

                # Use traditional position mode with hold
                async with self._bus_lock:
                    await asyncio.to_thread(
                        self.servo_bus.move_to_degrees, addr, speed_rpm, settings.DEFAULT_ACCELERATION, target_deg
                    )
                self.target_angles[axis] = float(target_deg)
                logger.info(f"[POSITION] Moving {axis} to {target_deg:.2f}° @ {speed_rpm} rpm")

                # Settle and optionally lock
                await self._settle_and_hold(axis, addr, target_deg)
                return True

        except Exception as e:
            logger.error(f"Error moving servo {axis}: {e}")
            return False

    async def emergency_stop(self) -> bool:
        if not self.running or not self.servo_bus:
            return False
        logger.warning("EMERGENCY STOP")
        ok = True
        async with self._bus_lock:
            for addr, axis in [
                (settings.SERVO_AZ_ADDR, "AZ"),
                (settings.SERVO_EL_ADDR, "EL"),
                (settings.SERVO_CL_ADDR, "CL"),
            ]:
                try:
                    await asyncio.to_thread(self.servo_bus.emergency_stop, addr)
                    logger.info(f"Emergency stop sent to {axis}")
                except Exception as e:
                    logger.error(f"Failed to stop servo {axis}: {e}")
                    ok = False
        return ok

    # ---------- movement mode control ----------

    async def set_movement_mode(self, mode: str):
        """Set the movement mode and start/stop tracking controller as needed"""
        if mode not in ['position', 'speed', 'hybrid']:
            raise ValueError(f"Invalid movement mode: {mode}")

        # Reject hybrid mode - causes double-loop oscillation
        if mode == 'hybrid':
            logger.warning("Hybrid mode disabled pending redesign (causes double-loop oscillation)")
            raise ValueError("Hybrid mode temporarily disabled - use 'position' or 'speed' mode")

        old_mode = self.movement_mode
        self.movement_mode = mode

        # Stop tracking controller if it was running
        if self.tracking_controller and self.tracking_controller.running:
            await self.tracking_controller.stop()
            logger.info("Tracking controller stopped")

        logger.info(f"Movement mode changed: {old_mode} -> {mode}")

    def get_movement_mode(self) -> str:
        """Get the current movement mode"""
        return self.movement_mode

    def is_movement_active(self) -> bool:
        """
        Check if manual movement is active (within 1 second of last command).
        Used to pause servo telemetry during movements to reduce RS-485 bus contention.
        """
        if not self._movement_active:
            return False
        current_time = datetime.now(timezone.utc).timestamp()
        elapsed = current_time - self._last_movement_time
        if elapsed > 1.0:  # 1 second timeout
            self._movement_active = False
            return False
        return True

    # ---------- current ramping & settling ----------

    async def _ramp_current(self, addr: int, from_ma: int, to_ma: int, duration_ms: int):
        """
        Gradually ramp servo current from one level to another.
        Reduces mechanical stress and helps prevent oscillation.
        """
        if from_ma == to_ma or duration_ms <= 0:
            # No ramping needed, just set directly
            async with self._bus_lock:
                await asyncio.to_thread(self.servo_bus.set_current_ma, addr, to_ma)
            return

        steps = max(3, duration_ms // 50)  # At least 3 steps, ~50ms per step
        step_duration = duration_ms / (steps * 1000.0)  # Convert to seconds
        current_step = from_ma

        for i in range(steps):
            # Linear interpolation
            t = (i + 1) / steps
            current_step = int(from_ma + (to_ma - from_ma) * t)

            try:
                async with self._bus_lock:
                    await asyncio.to_thread(self.servo_bus.set_current_ma, addr, current_step)
                await asyncio.sleep(step_duration)
            except Exception as e:
                logger.error(f"Error ramping current: {e}")
                break

        logger.debug(f"Current ramped from {from_ma}mA to {to_ma}mA over {duration_ms}ms")

    async def _settle_and_hold(self, axis: str, addr: int, target_deg: float):
        """
        Wait for axis to settle after movement, then optionally engage position hold.
        This prevents the oscillation that occurs when position hold engages too quickly.
        """
        # Wait for settling time
        settling_sec = settings.SETTLING_TIME_MS / 1000.0
        await asyncio.sleep(settling_sec)

        # Check if axis is locked - if so, engage gentle position hold
        if self.axis_locked.get(axis, False):
            logger.debug(f"[{axis}] Engaging position hold after settling")

            # Ramp down to holding current
            await self._ramp_current(
                addr,
                settings.WORKING_CURRENT_MA,
                settings.HOLDING_CURRENT_MA,
                settings.CURRENT_RAMP_DURATION_MS
            )

            # Engage position mode to hold current position
            async with self._bus_lock:
                await asyncio.to_thread(
                    self.servo_bus.move_to_degrees,
                    addr,
                    10,  # Low speed for gentle hold
                    50,  # Low acceleration
                    target_deg
                )
        else:
            # Not locked - ramp down to idle current and coast
            logger.debug(f"[{axis}] Coasting at target (not locked)")
            await self._ramp_current(
                addr,
                settings.WORKING_CURRENT_MA,
                settings.IDLE_CURRENT_MA,
                settings.CURRENT_RAMP_DURATION_MS
            )

    # ---------- position locking ----------

    async def lock_position(self, axis: str) -> bool:
        """
        Engage position hold with holding current on the specified axis.
        Prevents drift by actively maintaining current position.
        """
        if not self.running or not self.servo_bus:
            return False

        axis = axis.upper()
        if axis not in ("AZ", "EL", "CL"):
            return False

        addr = {
            "AZ": settings.SERVO_AZ_ADDR,
            "EL": settings.SERVO_EL_ADDR,
            "CL": settings.SERVO_CL_ADDR,
        }[axis]

        try:
            # Get current position
            async with self._bus_lock:
                current_deg = await asyncio.to_thread(self.servo_bus.read_angle_degrees, addr)

            # Set holding current
            await self._ramp_current(addr, settings.IDLE_CURRENT_MA, settings.HOLDING_CURRENT_MA, settings.CURRENT_RAMP_DURATION_MS)

            # Engage position mode to hold current angle
            async with self._bus_lock:
                await asyncio.to_thread(
                    self.servo_bus.move_to_degrees,
                    addr,
                    10,  # Low speed for gentle hold
                    50,  # Low acceleration
                    current_deg
                )

            self.axis_locked[axis] = True
            logger.info(f"[{axis}] Position locked at {current_deg:.2f}°")
            return True

        except Exception as e:
            logger.error(f"Error locking {axis}: {e}")
            return False

    async def unlock_position(self, axis: str) -> bool:
        """
        Release position hold and set to idle current.
        Allows axis to move freely or coast.
        """
        if not self.running or not self.servo_bus:
            return False

        axis = axis.upper()
        if axis not in ("AZ", "EL", "CL"):
            return False

        addr = {
            "AZ": settings.SERVO_AZ_ADDR,
            "EL": settings.SERVO_EL_ADDR,
            "CL": settings.SERVO_CL_ADDR,
        }[axis]

        try:
            # Stop speed mode (coast to stop)
            async with self._bus_lock:
                await asyncio.to_thread(self.servo_bus.stop_speed_mode, addr, 100)

            # Ramp down to idle current
            await self._ramp_current(addr, settings.HOLDING_CURRENT_MA, settings.IDLE_CURRENT_MA, settings.CURRENT_RAMP_DURATION_MS)

            self.axis_locked[axis] = False
            logger.info(f"[{axis}] Position unlocked")
            return True

        except Exception as e:
            logger.error(f"Error unlocking {axis}: {e}")
            return False

    def get_lock_states(self) -> Dict[str, bool]:
        """Get lock state for all axes"""
        return self.axis_locked.copy()
