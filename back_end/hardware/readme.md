# Sensor Data Comparison and Recommendations

## Updated Summary of Overlapping Data

| **Data Type**       | **WT901C (MPU9250)**                     | **SEQURE M10-25Q (GPS + QMC5883L)**         | **Recommendation**                                                                 |
|----------------------|------------------------------------------|---------------------------------------------|------------------------------------------------------------------------------------|
| **Orientation (Pitch, Roll, Yaw)** | Full orientation (pitch, roll, yaw). Tilt-compensated yaw. | Yaw only (not tilt-compensated).            | Use WT901C for full orientation (pitch, roll, yaw).                                |
| **Magnetic Field**   | 3-axis magnetic field data.              | 3-axis magnetic field data.                 | Use WT901C for sensor fusion; use SEQURE M10 for compass-only applications.        |
| **Heading (Yaw)**    | Tilt-compensated yaw.                   | Non-tilt-compensated yaw.                   | Use WT901C for tilt-compensated heading.                                           |
| **Velocity**         | Short-term velocity (prone to drift).   | GPS-based velocity (highly accurate).       | Use SEQURE M10 for velocity measurements.                                          |
| **Position**         | Not available.                         | GPS-based position (latitude, longitude, altitude). | Use SEQURE M10 for position data.                                                 |
| **Altitude**         | Indirect (prone to drift).             | GPS-based altitude (reliable).              | Use SEQURE M10 for altitude measurements.                                          |

---

## Summary of Independent Data

### WT901C (MPU9250) Independent Data

| **Data Type**       | **Description**                                                                 | **Recommendation**                                                                 |
|----------------------|---------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| **Angular Velocity** | Measures rotational speed (°/s) around X, Y, Z axes using the gyroscope.        | Use for tracking antenna rotation speed and dynamic adjustments.                   |
| **Linear Acceleration** | Measures acceleration (m/s²) along X, Y, Z axes using the accelerometer.     | Use for detecting vibrations or sudden movements in the antenna system.            |
| **Temperature**      | Measures internal temperature of the IMU module.                               | Use for monitoring sensor stability and compensating for temperature-induced drift.|

---

### SEQURE M10-25Q (GPS + QMC5883L) Independent Data

| **Data Type**       | **Description**                                                                 | **Recommendation**                                                                 |
|----------------------|---------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| **Position**         | Provides latitude, longitude, and altitude based on GPS signals.               | Use for determining the antenna's location and aligning it with satellite paths.   |
| **Velocity**         | Provides speed and direction of movement based on GPS signals.                 | Use for tracking antenna movement or dynamic navigation.                           |
| **Satellite Information** | Number of satellites in view and their signal strength.                   | Use for monitoring GPS signal quality and ensuring reliable positioning.           |
| **Fix Type**         | Indicates whether the GPS has a 2D or 3D fix.                                  | Use for ensuring altitude data is available (requires 3D fix).                     |

---

## Recommendations for Applicability in Your Project

### Orientation (Pitch, Roll, Yaw)

- **Applicability**:
  - Use the **WT901C** for full orientation data (pitch, roll, yaw) to align the antenna with the satellite's position.
  - The tilt-compensated yaw from the WT901C is more reliable than the non-tilt-compensated yaw from the SEQURE M10-25Q.

- **Recommendation**:
  - Use the WT901C for antenna alignment and orientation tracking.

---

### Position and Velocity

- **Applicability**:
  - Use the **SEQURE M10-25Q** for GPS-based position (latitude, longitude, altitude) and velocity (speed and direction).
  - Position data is critical for determining the antenna's location relative to the satellite's ground track.
  - Velocity data can be used for dynamic adjustments in high-speed systems.

- **Recommendation**:
  - Use the SEQURE M10-25Q for position and velocity tracking.

---

### Magnetic Field and Heading

- **Applicability**:
  - Use the **WT901C** for magnetic field data as part of sensor fusion to calculate tilt-compensated heading (yaw).
  - Use the **SEQURE M10-25Q** for heading if tilt compensation is not required (e.g., when the antenna is level).

- **Recommendation**:
  - Use the WT901C for tilt-compensated heading and the SEQURE M10-25Q for backup heading data.

---

### Altitude

- **Applicability**:
  - Use the **SEQURE M10-25Q** for GPS-based altitude, which is more reliable than accelerometer-based altitude estimation from the WT901C.
  - Altitude data is critical for calculating the antenna's elevation angle.

- **Recommendation**:
  - Use the SEQURE M10-25Q for altitude measurements.

---

### Angular Velocity

- **Applicability**:
  - Use the **WT901C** for angular velocity data to monitor antenna rotation speed and ensure smooth tracking of satellites.

- **Recommendation**:
  - Use the WT901C for dynamic adjustments and rotational tracking.

---

### Linear Acceleration

- **Applicability**:
  - Use the **WT901C** for detecting vibrations or sudden movements in the antenna system.
  - This data can be used to trigger alerts or stabilize the system.

- **Recommendation**:
  - Use the WT901C for vibration monitoring and stability control.

---

### Temperature

- **Applicability**:
  - Use the **WT901C** to monitor the internal temperature of the IMU module.
  - Temperature data can be used to compensate for sensor drift caused by temperature changes.

- **Recommendation**:
  - Use the WT901C for temperature monitoring.

---

### Satellite Information

- **Applicability**:
  - Use the **SEQURE M10-25Q** to monitor the number of satellites in view and their signal strength.
  - This data ensures reliable GPS positioning and helps diagnose signal issues.

- **Recommendation**:
  - Use the SEQURE M10-25Q for GPS signal monitoring.

---

### Fix Type

- **Applicability**:
  - Use the **SEQURE M10-25Q** to ensure a 3D fix is available for altitude data.
  - A 2D fix is sufficient for latitude and longitude but not for elevation tracking.

- **Recommendation**:
  - Use the SEQURE M10-25Q to verify GPS fix type.
