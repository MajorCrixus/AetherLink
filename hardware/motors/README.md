# Aetherlink Motor System - Complete Documentation

## Overview

The Aetherlink antenna tracking system uses three servo motors controlled via RS485:

| Motor | Type | Address | Limit Type | Range |
|-------|------|---------|------------|-------|
| **Azimuth** | MKS Servo57D | 0x01 | Hardware limit switches | 0-360° |
| **Elevation** | MKS Servo57D | 0x02 | Software limits + stall detection | 0-90° |
| **Cross** | MKS Servo42D | 0x03 | Software limits + stall detection | -45° to +45° |

---

## Component Status

### 1. **Library ([mks_servo57d_lib.py](mks_servo57d_lib.py))** ✅ **COMPLETE**

The low-level driver implements **100% of the MKS Servo57D/42D RS485 protocol**.

#### Feature Coverage

| Category | Commands | Status |
|----------|----------|--------|
| **Position Reads** | 13 commands (0x30-0x48) | ✅ Complete |
| **Configuration** | 25 commands (0x80-0x9E) | ✅ Complete |
| **Motion Control** | 8 commands (0xF1-0xFE) | ✅ Complete |
| **PID/Acceleration** | 5 commands (0xA1-0xA5) | ✅ Complete |
| **System** | 6 commands (0x3D-0xFF) | ✅ Complete |

**Total: 57 commands implemented**

#### Key Capabilities
- ✅ Encoder reading (carry/addition/raw)
- ✅ Speed, position, error monitoring
- ✅ Hardware limit switch support (IN1/IN2)
- ✅ **Stall protection** (0x88) - Enable/disable
- ✅ **Position error protection** (0x9D) - Following error limits
- ✅ **Protection status reading** (0x3E) - Detect stalls
- ✅ **Release protection** (0x3D) - Clear stall flags
- ✅ I/O control (read/write IN1, IN2, OUT1, OUT2)
- ✅ Homing with/without limit switches
- ✅ Speed mode, position mode (relative/absolute)
- ✅ Emergency stop
- ✅ PID tuning, acceleration curves
- ✅ Factory reset, restart

---

### 2. **FastAPI Service ([servo57d_api.py](servo57d_api.py))** ⚠️ **MISSING ENDPOINTS**

The REST API provides web access to motor control but is **missing some advanced features**.

#### Currently Implemented Endpoints ✅

**Motion Control:**
- `POST /enable/{on}` - Enable/disable motor
- `POST /estop` - Emergency stop
- `POST /motion/speed` - Speed mode
- `POST /motion/stop` - Stop motion
- `POST /motion/rel/deg` - Relative move (degrees)
- `POST /motion/abs/deg` - Absolute move (degrees)
- `POST /motion/rel/axis` - Relative move (axis ticks)
- `POST /motion/abs/axis` - Absolute move (axis ticks)

**Homing:**
- `POST /home` - Go to home position
- `POST /zero` - Set current position as zero
- `POST /single_turn_home` - Single-turn homing

**I/O:**
- `GET /io` - Read I/O states
- `POST /io` - Write outputs

**Configuration:**
- `POST /config/mode/{mode}` - Set control mode
- `POST /config/dir/{d}` - Set direction
- `POST /config/en_active/{v}` - Set EN polarity
- `POST /config/current_ma/{ma}` - Set current
- `POST /config/hold_current_pct/{pct}` - Set hold current
- `POST /config/microstep/{m}` - Set microstepping
- `POST /config/baud_code/{code}` - Set baud rate
- `POST /config/addr/{new_addr}` - Set address
- `POST /config/respond` - Enable/disable responses
- `POST /config/limits/{enable}` - Enable firmware limits
- `POST /config/restart` - Restart motor
- `POST /config/factory_reset` - Factory reset

**Monitoring:**
- `GET /health` - API health check
- `GET /snapshot` - Snapshot of all data
- `GET /last/{name}` - Last reading (enc|speed|io|status|err|angle)
- `GET /sse` - Server-Sent Events stream
- `WS /ws` - WebSocket stream

#### Missing from API ⚠️

**Protection & Safety:**
- ❌ `POST /config/stall_protect/{enable}` - Enable/disable stall detection
- ❌ `POST /config/position_protect` - Configure position error protection
- ❌ `GET /protect/status` - Read protection status
- ❌ `POST /protect/release` - Release protection (clear stall)

**Advanced Configuration:**
- ❌ `POST /config/pid/kp/{value}` - Set position Kp
- ❌ `POST /config/pid/ki/{value}` - Set position Ki
- ❌ `POST /config/pid/kd/{value}` - Set position Kd
- ❌ `POST /config/accel/start/{value}` - Set start acceleration
- ❌ `POST /config/accel/stop/{value}` - Set stop acceleration
- ❌ `POST /config/autosleep/{enable}` - Enable/disable auto-sleep
- ❌ `POST /config/interpolation/{enable}` - Enable microstep interpolation
- ❌ `POST /config/key_lock/{enable}` - Enable key lock
- ❌ `POST /config/group_addr/{addr}` - Set group address

**Advanced Reads:**
- ❌ `GET /encoder/carry` - Read encoder with carry
- ❌ `GET /encoder/raw` - Read raw encoder
- ❌ `GET /pulses` - Read pulse count
- ❌ `GET /status/en` - Read EN status
- ❌ `GET /status/zero` - Read zero status
- ❌ `GET /version` - Read firmware version

**Homing Advanced:**
- ❌ `POST /config/home_params` - Configure homing parameters
- ❌ `POST /config/nolimit_home` - Configure no-limit homing
- ❌ `POST /config/home_direction/{cw}` - Set homing direction

**Bulk Operations:**
- ❌ `GET /config/params` - Read all parameters
- ❌ `POST /config/params` - Write all parameters
- ❌ `GET /status/all` - Read all status

---

### 3. **Limit Protection System ([limit_protection.py](limit_protection.py))** ✅ **NEW - COMPLETE**

Comprehensive protection system addressing your requirements:

#### Protection Strategy by Motor

**Azimuth (0x01) - Hardware Limits:**
- ✅ Physical limit switches on IN1 and IN2
- ✅ Firmware-enforced limits (0x9E command)
- ✅ Automatic stop when limit hit
- ✅ Range: 0-360° with 10° warning zones

**Elevation (0x02) - Software Limits + Stall Detection:**
- ✅ No physical switches
- ✅ Software angle limits (0-90°)
- ✅ **Stall detection enabled** (0x88 command)
- ✅ Position following error monitoring (0x39)
- ✅ Automatic detection of mechanical blockage
- ✅ Recovery procedures (back-off from limit)
- ✅ 5° warning zones before limits

**Cross (0x03) - Software Limits + Stall Detection:**
- ✅ No physical switches
- ✅ Software angle limits (-45° to +45°)
- ✅ **Stall detection enabled** (0x88 command)
- ✅ Position following error monitoring
- ✅ Automatic mechanical blockage detection
- ✅ Recovery procedures
- ✅ 5° warning zones

#### How Stall Detection Works

The MKS Servo57D/42D supports **hardware stall detection** (command 0x88):

1. **Enable stall protection**: `servo.set_stall_protect(addr, True)`
2. **Monitor protection status**: `servo.read_protect_status(addr)` returns:
   - `0` = Stall/protection triggered
   - `1` = Normal operation
3. **Clear stall**: `servo.release_protect(addr)`

When enabled, the motor firmware automatically:
- Monitors motor current
- Detects when motor cannot move (stalled/blocked)
- Sets protection flag
- Can trigger emergency stop (depending on configuration)

This is **perfect for your elevation and cross motors** since they don't have physical limit switches!

#### Position Following Error Detection

Secondary protection via **position error monitoring**:

```python
# Configure (already done in limit_protection.py)
servo.set_en_zero_and_pos_protect(
    addr=0x02,
    en_zero=False,
    pos_protect=True,
    trig_time_ms=1000,        # Trigger after 1 second
    trig_distance_ticks=500   # ~11° following error
)

# Monitor
axis_error = servo.read_axis_error(addr)  # Read position error
if abs(axis_error) > 500:
    # Motor not reaching commanded position - possible mechanical issue
    pass
```

---

## Usage Examples

### Basic Control with Protection

```python
from back_end.hardware.motors.multi_motor_controller import MotorController

# Initialize with protection enabled (default)
mc = MotorController("/dev/ttyUSB0")
mc.initialize_all()
mc.enable_all()

# Safe moves with automatic limit validation
try:
    mc.move_elevation(45.0, rpm=400)  # ✅ Validated
    mc.move_cross(30.0, rpm=300)      # ✅ Validated
    mc.move_azimuth(180.0, rpm=600)   # ✅ Validated
except ValueError as e:
    print(f"Move rejected: {e}")

# Force move without validation (use with caution!)
mc.move_elevation(45.0, rpm=400, safe=False)
```

### Monitoring Limits

```python
# Check all motors
limit_status = mc.check_all_limits()
for motor, status in limit_status.items():
    if status.in_warning_zone:
        print(f"⚠️  {motor}: {status.message}")
    if status.violation_type != LimitViolationType.NONE:
        print(f"🛑 {motor}: VIOLATION - {status.message}")

# Check specific motor
el_status = mc.check_motor_limits("elevation")
if el_status.violation_type == LimitViolationType.STALL_DETECTED:
    print("Elevation motor stalled!")
```

### Handling Stall Detection

```python
from back_end.hardware.motors.limit_protection import LimitViolationType

# Move elevation motor
mc.move_elevation(85.0, rpm=400)

# Monitor during move
import time
while True:
    status = mc.check_motor_limits("elevation")

    if status.violation_type == LimitViolationType.STALL_DETECTED:
        print("Stall detected! Attempting recovery...")
        protection = mc.get_protection_system()
        if protection.recover_from_limit("elevation", status):
            print("Recovery successful")
        break

    if status.violation_type == LimitViolationType.SOFTWARE_MAX:
        print("Reached maximum angle!")
        break

    time.sleep(0.1)
```

### Direct Protection System Access

```python
from back_end.hardware.motors.limit_protection import create_aetherlink_protection
from back_end.hardware.motors.mks_servo57d_lib import MKSServo57D

servo = MKSServo57D("/dev/ttyUSB0")
protection = create_aetherlink_protection(servo)

# Validate before move
is_safe, reason = protection.validate_move("elevation", 85.0)
if not is_safe:
    print(f"Cannot move: {reason}")

# Safe move with validation
success, msg = protection.safe_move_to("elevation", 45.0, speed_rpm=400)

# Check limits
status = protection.check_limits("elevation")
print(f"Current angle: {status.current_angle:.1f}°")
print(f"Axis error: {status.axis_error} ticks")
print(f"Protect flag: {status.protect_flag}")

# Emergency stop all
protection.emergency_stop_all()
```

### Customizing Limits

```python
# Update elevation limits (default is 0-90°)
mc.update_motor_limits(
    "elevation",
    min_angle=5.0,        # Don't go below 5°
    max_angle=85.0,       # Don't go above 85°
    warning_margin=3.0,   # Warn 3° before limit
    max_following_error=300  # ~6.6° following error tolerance
)

# Update cross limits
mc.update_motor_limits(
    "cross",
    min_angle=-40.0,
    max_angle=40.0,
    stall_detection_enabled=True,
    recovery_distance=5.0  # Back off 5° on limit hit
)
```

### Violation Callbacks

```python
# Register callback for limit violations
def on_violation(motor_name: str, status: LimitStatus):
    print(f"⚠️  VIOLATION on {motor_name}: {status.message}")
    # Send alert, log to database, etc.

protection = mc.get_protection_system()
protection.register_violation_callback(on_violation)
```

---

## Testing Stall Detection

To verify stall detection works on your elevation/cross motors:

### Test 1: Manual Blockage

```python
mc = MotorController("/dev/ttyUSB0")
mc.initialize_all()
mc.enable_all()

# Start moving elevation
mc.move_elevation(60.0, rpm=200, safe=False)

# Manually block the motor mechanically
# Monitor status
import time
for i in range(50):
    status = mc.check_motor_limits("elevation")
    print(f"Protect flag: {status.protect_flag}, Axis error: {status.axis_error}")

    if status.violation_type == LimitViolationType.STALL_DETECTED:
        print("✅ Stall detected successfully!")
        break

    time.sleep(0.1)
```

### Test 2: Software Limit Enforcement

```python
# Try to move beyond limit
try:
    mc.move_elevation(95.0, rpm=400)  # Above 90° max
    print("❌ Should have been rejected!")
except ValueError as e:
    print(f"✅ Correctly rejected: {e}")

# Try to move below minimum
try:
    mc.move_cross(-50.0, rpm=300)  # Below -45° min
    print("❌ Should have been rejected!")
except ValueError as e:
    print(f"✅ Correctly rejected: {e}")
```

---

## API Enhancement Recommendations

To make the servo API feature-complete, add these endpoints:

### High Priority (Protection & Safety)

```python
@app.post("/config/stall_protect/{motor}/{enable}")
async def cfg_stall_protect(motor: str, enable: int):
    addr = _motor_addr_map[motor]
    c = hub.servo.set_stall_protect(addr, bool(enable))
    return {"ok": True, "code": c}

@app.get("/protect/status/{motor}")
async def protect_status(motor: str):
    addr = _motor_addr_map[motor]
    status = hub.servo.read_protect_status(addr)
    return {"motor": motor, "protect_flag": status, "stalled": status == 0}

@app.post("/protect/release/{motor}")
async def protect_release(motor: str):
    addr = _motor_addr_map[motor]
    c = hub.servo.release_protect(addr)
    return {"ok": True, "code": c}

@app.get("/limits/check")
async def limits_check():
    # Use protection system to check all limits
    return protection.check_all_motors()
```

### Medium Priority (PID & Advanced Config)

```python
@app.post("/config/pid")
async def cfg_pid(body: PIDBody):
    # kp, ki, kd as parameters
    pass

@app.post("/config/accel")
async def cfg_accel(body: AccelBody):
    # start_accel, stop_accel
    pass
```

---

## Summary & Recommendations

### ✅ What's Complete
1. **mks_servo57d_lib.py** - 100% feature complete
2. **limit_protection.py** - Comprehensive protection system with stall detection
3. **multi_motor_controller.py** - Enhanced with integrated protection

### ⚠️ What Needs Attention
1. **servo57d_api.py** - Missing ~25 endpoints for advanced features
   - Recommendation: Add protection endpoints as minimum
   - Optional: Add PID, advanced config, bulk operations

### 🎯 Your Limit Strategy
- **Azimuth**: Hardware limits (working) ✅
- **Elevation**: Software limits + **stall detection** ✅
- **Cross**: Software limits + **stall detection** ✅

The stall detection feature (0x88 command) is **exactly what you need** for motors without physical limit switches. It will:
- Detect mechanical blockage/jamming
- Prevent damage from over-travel
- Trigger protection flags you can monitor
- Allow software recovery procedures

---

## Files Added/Modified

### New Files ✅
1. `/back_end/hardware/motors/limit_protection.py` - Protection system
2. `/back_end/hardware/motors/multi_motor_controller.py` - Enhanced controller

### Modified Files
- `/back_end/hardware/motors/multi_motor_controller.py` - Added protection integration

### Existing Files (No Changes Needed)
- `/back_end/hardware/motors/mks_servo57d_lib.py` - Already complete
- `/back_end/hardware/motors/servo57d_api.py` - Functional but missing endpoints

---

## Quick Start

```python
from back_end.hardware.motors.multi_motor_controller import MotorController

# Initialize with protection (stall detection automatically enabled)
with MotorController("/dev/ttyUSB0") as mc:
    mc.initialize_all()
    mc.enable_all()

    # Safe moves with automatic validation
    mc.move_azimuth(180.0, rpm=600)    # Hardware limits
    mc.move_elevation(45.0, rpm=400)   # Software + stall detection
    mc.move_cross(30.0, rpm=300)       # Software + stall detection

    # Monitor for issues
    limits = mc.check_all_limits()
    for motor, status in limits.items():
        if status.violation_type != 0:
            print(f"{motor}: {status.message}")
```

