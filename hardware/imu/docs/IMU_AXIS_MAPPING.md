# IMU Axis Mapping - CONFIRMED

## Hardware: WitMotion WT901C 9-Axis IMU
## Location: Mounted on antenna dish

---

## CONFIRMED MAPPING (Tested 2025-10-20)

### Test: 180° Azimuth Rotation (Clockwise)

**Before:**
- Roll (X): -0.29°
- Pitch (Y): -0.13°
- Yaw (Z): -144.13°

**After:**
- Roll (X): -0.07° (Δ +0.22°)
- Pitch (Y): -0.18° (Δ -0.05°)
- Yaw (Z): 171.02° (Δ +315.15°)

---

## AXIS DEFINITIONS

| IMU Axis | Antenna Motion | Description |
|----------|---------------|-------------|
| **Yaw (Z)** | **AZIMUTH** | Left/Right rotation (compass heading) |
| **Pitch (Y)** | **ELEVATION** | Up/Down tilt |
| **Roll (X)** | **CROSS-LEVEL** | Side-to-side tilt |

---

## Webapp Display Mapping

```javascript
// Correct mapping for webapp display
const antennaPosition = {
    azimuth: imu.yaw_deg,      // Z-axis rotation
    elevation: imu.pitch_deg,   // Y-axis tilt
    crossLevel: imu.roll_deg    // X-axis tilt
}
```

---

## Notes

- Yaw wraps at ±180° (full rotation: -180° to +180°)
- Positive Yaw = Clockwise rotation (looking from above)
- Positive Pitch = Dish pointing upward
- Positive Roll = Dish tilted to right

---

## Next Calibration Steps

1. ✅ Azimuth (Yaw) - CONFIRMED
2. ⏳ Elevation (Pitch) - Test by tilting dish up/down
3. ⏳ Cross-level (Roll) - Test by tilting dish left/right
