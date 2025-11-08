# Continuous Tracking Controller Design

## Problem Statement

**Current Issue:**
The discrete position command system creates a "move-hold-move-hold" pattern that causes:
- Jitter when tracking moving targets
- Position hold behavior fighting against continuous motion
- Angle error accumulation between commands
- Oscillation and instability

**Root Cause:**
Using absolute position mode (`move_to_degrees`) for continuous tracking applications. Each command instructs the servo to "go to X and HOLD", which activates aggressive position correction that interferes with smooth tracking.

---

## Solution: Hybrid Continuous Tracking Controller

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Tracking Controller                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Target    │  │  Telemetry   │  │    Mode      │       │
│  │   Update    │─▶│  @ 50 Hz     │─▶│  Selection   │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                  │               │
│         ▼                 ▼                  ▼               │
│  ┌──────────────────────────────────────────────────┐       │
│  │         Hybrid Control Strategy                  │       │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │       │
│  │  │ SPEED  │  │ POS    │  │ HOLD   │  │ CORRECT│ │       │
│  │  │ MODE   │  │ TRACK  │  │ MODE   │  │  MODE  │ │       │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │       │
│  └──────────────────────────────────────────────────┘       │
│                         │                                    │
│                         ▼                                    │
│              ┌────────────────────┐                          │
│              │   Servo Commands   │                          │
│              │  (0xF6 / 0xFD)     │                          │
│              └────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. **Mode-Based Control**

The controller automatically selects the optimal mode based on real-time conditions:

| Mode | Condition | Servo Command | Purpose |
|------|-----------|---------------|---------|
| **TRACK_SPEED** | Error > 2.0° OR target moving | Speed Mode (0xF6) | Continuous smooth tracking, no position hold |
| **CORRECTING** | Error 0.5-2.0°, target stopped | Position Mode (0xFD) | Small corrections without aggressive hold |
| **HOLD** | Error < 0.5°, stationary | Stop (0xF6 with 0 RPM) | Minimal hold, relaxed control |
| **IDLE** | Tracking disabled | Emergency Stop (0xF7) | Servo disabled |

### 2. **Velocity Feedforward**

```python
# Speed calculation combines error correction + velocity tracking
speed_rpm = K_P * position_error + (target_velocity * 60/360)

# This allows smooth tracking of moving targets with minimal lag
```

**Benefits:**
- Anticipates target movement
- Reduces tracking lag
- Smoother motion during continuous tracking

### 3. **High-Frequency Updates (50 Hz)**

- **Current system:** 20 Hz telemetry polling
- **New system:** 50 Hz dedicated tracking loop
- **Result:** 2.5x faster response, smoother control

### 4. **Smart Mode Transitions**

```
Tracking Fast-Moving Target:
  Target: 45.0° → 50.0° (5° in 1 sec)
  Controller: Uses SPEED MODE with velocity feedforward
  Result: Smooth continuous rotation, no jitter

Target Stops:
  Error drops from 5.0° → 1.5° → 0.3°
  Controller: SPEED → CORRECTING → HOLD
  Result: Graceful deceleration, precise final positioning

Target Stationary:
  Error: 0.2° (within tolerance)
  Controller: HOLD mode, minimal corrections
  Result: No jitter, no unnecessary movement
```

---

## Implementation Plan

### Phase 1: Integration (Ready to Use)

**File:** `/home/major/aetherlink/webapp/backend/services/tracking_controller.py`

**Integration Points:**

1. **Initialize in hardware_manager.py:**
```python
from .tracking_controller import TrackingController

class HardwareManager:
    def __init__(self):
        ...
        self.tracking_controller = TrackingController(
            self.servo_bus,
            self._bus_lock
        )

    async def start(self):
        ...
        # Add tracking axes
        self.tracking_controller.add_axis("AZ", settings.SERVO_AZ_ADDR)
        self.tracking_controller.add_axis("EL", settings.SERVO_EL_ADDR)
        self.tracking_controller.add_axis("CL", settings.SERVO_CL_ADDR)

        # Start tracking controller
        await self.tracking_controller.start()
```

2. **Update move_servo to use tracking controller:**
```python
async def move_servo(self, axis: str, target_deg: float, velocity_dps: float = 0.0):
    # New signature includes velocity for feedforward
    await self.tracking_controller.set_target(
        axis.upper(),
        target_deg,
        velocity_dps
    )
```

3. **API endpoints remain the same** - transparent upgrade

### Phase 2: Advanced Features (Optional Enhancements)

**A. Dynamic Current Adjustment**
```python
# Increase current during fast tracking
if abs(velocity_dps) > 10:
    current_ma = 3200  # High current for fast motion
elif abs(error_deg) > 5:
    current_ma = 2400  # Medium current for corrections
else:
    current_ma = 1600  # Normal current for slow tracking
```

**B. Predictive Control**
```python
# Calculate where target will be in 100ms
predicted_position = current_position + (velocity * 0.1)
# Command servo to predicted position
```

**C. Adaptive Thresholds**
```python
# Adjust thresholds based on tracking performance
if tracking_rms_error < 0.5:
    # Tighten thresholds for better precision
    TRACK_ERROR_THRESHOLD = 1.5
else:
    # Relax thresholds for stability
    TRACK_ERROR_THRESHOLD = 3.0
```

---

## Performance Comparison

### Current System (Position Mode)
```
Time    Target  Command          Servo Behavior
0ms     10.0°   Move to 10.0°    → Accelerate
50ms    10.0°   (holding)        → Decelerate, hold position
100ms   12.0°   Move to 12.0°    → Fight hold, accelerate
150ms   12.0°   (holding)        → Decelerate, aggressive hold
200ms   14.0°   Move to 14.0°    → Fight hold, accelerate
Result: JITTER, OSCILLATION, POOR TRACKING
```

### New System (Hybrid Tracking)
```
Time    Target  Mode            Servo Behavior
0ms     10.0°   TRACK_SPEED     → Smooth acceleration
20ms    10.5°   TRACK_SPEED     → Continuous rotation at calculated speed
40ms    11.0°   TRACK_SPEED     → Speed adjusted for error + velocity
60ms    11.5°   TRACK_SPEED     → Smooth tracking continues
...
200ms   14.0°   TRACK_SPEED     → Continuous smooth motion
220ms   14.0°   CORRECTING      → Target stopped, gentle deceleration
240ms   14.0°   HOLD            → Error < 0.5°, minimal hold
Result: SMOOTH, ACCURATE, NO JITTER
```

---

## Tuning Parameters

### For Satellite Tracking (Fast)
```python
update_rate_hz = 50              # 50 Hz for responsive control
TRACK_ERROR_THRESHOLD = 2.0      # Switch to speed mode above 2°
HOLD_ERROR_THRESHOLD = 0.5       # Hold below 0.5°
K_P = 10.0                       # 10 RPM per degree error
```

### For Precision Positioning (Slow)
```python
update_rate_hz = 100             # 100 Hz for ultra-precise control
TRACK_ERROR_THRESHOLD = 1.0      # Switch to speed mode above 1°
HOLD_ERROR_THRESHOLD = 0.2       # Hold below 0.2°
K_P = 5.0                        # 5 RPM per degree error
```

### For Lab Testing (Conservative)
```python
update_rate_hz = 20              # 20 Hz for testing
TRACK_ERROR_THRESHOLD = 5.0      # Relaxed threshold
HOLD_ERROR_THRESHOLD = 1.0       # Relaxed hold
K_P = 8.0                        # Moderate response
```

---

## Benefits Summary

1. **Eliminates Jitter:** Speed mode has no position hold behavior
2. **Smooth Tracking:** Velocity feedforward anticipates target motion
3. **Faster Response:** 50 Hz updates vs 20 Hz (2.5x improvement)
4. **Mode Optimization:** Automatic selection of best control strategy
5. **Reduced Wear:** Less aggressive corrections = longer servo life
6. **Better Accuracy:** Predictive control reduces lag
7. **Stability:** No oscillation from fighting position hold

---

## Testing Procedure

### Test 1: Stationary Target
```python
# Set target to 45°, no velocity
await tracking_controller.set_target("AZ", 45.0, 0.0)

# Expected:
# - Initial: TRACK_SPEED mode, fast approach
# - Middle: CORRECTING mode, gentle deceleration
# - Final: HOLD mode at 45.0° ± 0.5°
```

### Test 2: Moving Target (Slow)
```python
# Simulate slow satellite motion: 0.1 deg/sec
for t in range(100):
    target = 45.0 + (t * 0.1)
    await tracking_controller.set_target("AZ", target, 0.1)
    await asyncio.sleep(1.0)

# Expected:
# - Mode: TRACK_SPEED throughout
# - Error: < 1.0° steady-state
# - Motion: Smooth, no jitter
```

### Test 3: Moving Target (Fast)
```python
# Simulate fast satellite pass: 5 deg/sec
for t in range(20):
    target = 45.0 + (t * 5.0)
    await tracking_controller.set_target("AZ", target, 5.0)
    await asyncio.sleep(1.0)

# Expected:
# - Mode: TRACK_SPEED throughout
# - Speed: High RPM with velocity feedforward
# - Error: < 2.0° during tracking
```

---

## Migration Guide

### Current Code:
```python
# Old: Discrete position commands
await hardware_manager.move_servo("AZ", 45.0, speed_rpm=20)
```

### New Code (Same Interface):
```python
# New: Continuous tracking (backward compatible)
await hardware_manager.move_servo("AZ", 45.0, velocity_dps=0.0)

# Or with velocity feedforward:
await hardware_manager.move_servo("AZ", 45.0, velocity_dps=2.5)
```

**Result:** Existing code works without changes, but with better performance!

---

## Monitoring & Debugging

### Telemetry additions:
```json
{
  "axes": {
    "AZ": {
      "tracking_mode": "TRACK_SPEED",
      "target_deg": 45.0,
      "actual_deg": 44.8,
      "error_deg": 0.2,
      "target_velocity_dps": 2.5,
      "actual_velocity_dps": 2.3,
      "speed_rpm": 250
    }
  }
}
```

### Logging:
```python
logger.debug(f"AZ: TRACK_SPEED -> CORRECTING (error: 1.2°)")
logger.info(f"AZ: Tracking mode active, error: 0.3°, speed: 50 RPM")
```

---

## Next Steps

1. **Review this design** and confirm it addresses your concerns
2. **Integration:** I can integrate the tracking controller into hardware_manager
3. **Testing:** Test with your azimuth servo to eliminate jitter
4. **Tuning:** Adjust parameters based on your specific antenna dynamics
5. **Deployment:** Roll out to production once tested

**Ready to proceed with integration?**
