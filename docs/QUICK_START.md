# Motor System Quick Start Guide

## TL;DR - What You Need to Know

### Your Motors
- **Azimuth (0x01)**: Has limit switches ✅
- **Elevation (0x02)**: NO limit switches - uses **stall detection** ✅
- **Cross (0x03)**: NO limit switches - uses **stall detection** ✅

### Stall Detection Solution
YES! The MKS Servo57D/42D has **built-in stall detection** (command 0x88). It's already enabled for your elevation and cross motors. The firmware monitors motor current and automatically detects when the motor hits a physical obstruction.

---

## Files Added

1. **[limit_protection.py](limit_protection.py)** - Comprehensive protection system
2. **[MOTOR_SYSTEM_DOCUMENTATION.md](MOTOR_SYSTEM_DOCUMENTATION.md)** - Complete documentation
3. **[test_limit_protection.py](test_limit_protection.py)** - Test suite

## Files Enhanced

1. **[multi_motor_controller.py](multi_motor_controller.py)** - Added protection integration

---

## Simplest Usage

```python
from back_end.hardware.motors.multi_motor_controller import MotorController

# Initialize (stall detection automatically enabled)
with MotorController("/dev/ttyUSB0") as mc:
    mc.initialize_all()
    mc.enable_all()

    # These moves are automatically validated
    mc.move_azimuth(180.0, rpm=600)    # Stops at hardware limits
    mc.move_elevation(45.0, rpm=400)   # Stops at software limits OR stall
    mc.move_cross(30.0, rpm=300)       # Stops at software limits OR stall
```

That's it! Protection is automatic.

---

## How Stall Detection Works

### 1. Enabled by Default
```python
# Automatically done in limit_protection.py for elevation & cross
servo.set_stall_protect(addr=0x02, enable=True)  # Elevation
servo.set_stall_protect(addr=0x03, enable=True)  # Cross
```

### 2. Monitored Automatically
```python
# Check if motor stalled
protect_flag = servo.read_protect_status(addr)
# Returns: 0 = stalled, 1 = normal

# Or use the protection system
status = mc.check_motor_limits("elevation")
if status.violation_type == LimitViolationType.STALL_DETECTED:
    print("Motor stalled!")
```

### 3. Clear Stall and Recover
```python
# Clear the stall flag
servo.release_protect(addr)

# Or use automatic recovery
protection = mc.get_protection_system()
protection.recover_from_limit("elevation", status)
```

---

## Limit Configuration

### Current Defaults

**Azimuth:**
- Range: 0-360°
- Hardware limits: Enabled
- Warning zone: 10° from limits

**Elevation:**
- Range: 0-90°
- Stall detection: **Enabled** ✅
- Warning zone: 5° from limits
- Following error tolerance: ~11°

**Cross:**
- Range: -45° to +45°
- Stall detection: **Enabled** ✅
- Warning zone: 5° from limits
- Following error tolerance: ~8.8°

### Change Limits

```python
mc.update_motor_limits(
    "elevation",
    min_angle=5.0,
    max_angle=85.0,
    warning_margin=3.0
)
```

---

## Testing

### Quick Test
```python
python3 back_end/hardware/motors/test_limit_protection.py
```

### Manual Stall Test
1. Run: `mc.move_elevation(60.0, rpm=200, safe=False)`
2. Physically block the motor
3. Check status: `mc.check_motor_limits("elevation")`
4. Should show `STALL_DETECTED`

---

## API Status

### servo57d_api.py Assessment

**Currently Implemented:** 30+ endpoints ✅
- Motion control (speed, position, homing)
- Basic configuration (current, mode, microsteps)
- I/O read/write
- Monitoring (SSE, WebSocket)

**Missing:** ~25 endpoints ⚠️
- **Stall protection endpoints** (recommended to add)
- PID tuning
- Advanced configuration
- Bulk operations

### Recommended API Additions

Add these for complete protection support:

```python
POST /config/stall_protect/{motor}/{enable}  # Enable/disable stall detection
GET /protect/status/{motor}                   # Read protection status
POST /protect/release/{motor}                 # Clear stall flag
GET /limits/check                             # Check all limit violations
```

---

## Common Scenarios

### Scenario 1: Motor Hits Software Limit
```python
try:
    mc.move_elevation(95.0)  # Above 90° max
except ValueError as e:
    print(f"Rejected: {e}")  # "Target 95.0° above maximum 90.0°"
```

### Scenario 2: Motor Stalls (Physical Obstruction)
```python
mc.move_elevation(60.0, rpm=400)

# Monitor during move
while True:
    status = mc.check_motor_limits("elevation")
    if status.violation_type == LimitViolationType.STALL_DETECTED:
        print("Stall detected!")
        # Automatic recovery
        mc.get_protection_system().recover_from_limit("elevation", status)
        break
    time.sleep(0.1)
```

### Scenario 3: Check Before Move
```python
protection = mc.get_protection_system()
is_safe, reason = protection.validate_move("elevation", 85.0)

if is_safe:
    mc.move_elevation(85.0)
else:
    print(f"Cannot move: {reason}")
```

### Scenario 4: Bypass Protection (Careful!)
```python
# Use safe=False to bypass validation
# Only use when you know what you're doing!
mc.move_elevation(45.0, safe=False)
```

---

## Emergency Procedures

### Emergency Stop All Motors
```python
mc.emergency_stop_all()
```

### Clear All Stalls
```python
for motor in ["azimuth", "elevation", "cross"]:
    mc.servo.release_protect(mc._get_addr(motor))
```

### Disable Protection System
```python
mc.get_protection_system().enable(False)  # Disable
mc.get_protection_system().enable(True)   # Re-enable
```

---

## Key Takeaways

1. ✅ **Stall detection is available** - It's already enabled for elevation/cross motors
2. ✅ **Library is 100% complete** - All 57 commands implemented
3. ✅ **Protection system is automatic** - Just use `MotorController`
4. ⚠️ **API needs enhancement** - Missing ~25 endpoints (but functional)

Your elevation and cross motors are protected via:
- Software angle limits (enforced before move)
- Hardware stall detection (detects mechanical blockage)
- Position following error monitoring (detects control issues)

---

## Need Help?

1. Read: [MOTOR_SYSTEM_DOCUMENTATION.md](MOTOR_SYSTEM_DOCUMENTATION.md)
2. Run tests: `python3 test_limit_protection.py`
3. Check library code: [mks_servo57d_lib.py](mks_servo57d_lib.py)

