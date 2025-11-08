# IMU Calibration Log

## Baseline Reading (Antenna at rest)
- **Roll (X)**: -0.29°
- **Pitch (Y)**: -0.13°
- **Yaw (Z)**: -144.13°

## Movement Tests

### Test 1: Azimuth Rotation (Clockwise)
**Expected**: Yaw should INCREASE
**Antenna Action**: Rotate clockwise ~30-45° (looking from above)
**Result**: [PENDING - waiting for user to move antenna]

### Test 2: Elevation (Up)
**Expected**: Pitch should INCREASE
**Antenna Action**: Tilt dish upward ~20-30°
**Result**: [PENDING]

### Test 3: Elevation (Down)
**Expected**: Pitch should DECREASE
**Antenna Action**: Tilt dish downward ~20-30°
**Result**: [PENDING]

### Test 4: Cross-level (Roll Right)
**Expected**: Roll should INCREASE
**Antenna Action**: Tilt dish to the right ~15-20°
**Result**: [PENDING]

---

## Instructions
After each movement, run:
```bash
python3 -c "from hardware.imu.wt901c import WT901C; import time; imu=WT901C('/dev/imu',9600); imu.start(); time.sleep(2); angles=imu.last(0x53); print(f'Roll: {angles.roll_deg:.2f}° Pitch: {angles.pitch_deg:.2f}° Yaw: {angles.yaw_deg:.2f}°')"
```

Then tell me the new values.
