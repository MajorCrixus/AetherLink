# WitMotion WT901C-TTL Complete Implementation Guide

## Overview

This is a **complete, production-ready implementation** for the WitMotion WT901C-TTL 9-Axis IMU, providing **100% access** to all module capabilities:

- **9-Axis IMU**: 3-axis accelerometer, gyroscope, magnetometer
- **Orientation**: Euler angles (roll, pitch, yaw) and quaternions
- **Barometer**: Pressure and altitude (device-dependent)
- **GPS**: Position and accuracy data (WT901C485GPS variant only)
- **Digital I/O**: Port status monitoring (DPORT)
- **Advanced Configuration**: Unlock/lock, installation direction, calibration, angle reference

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   WT901C-TTL Module                          │
│              (MPU9250 + MCU + Serial TTL)                    │
└────────────────────────┬─────────────────────────────────────┘
                         │ UART (9600-115200 baud)
                         ▼
                  ┌──────────────┐
                  │  wt901c.py   │  ← Core Driver
                  │  (Enhanced)  │
                  └──────┬───────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌──────────┐  ┌──────────────┐  ┌─────────┐
    │ CLI Test │  │ FastAPI      │  │  Your   │
    │ Tool     │  │ Service      │  │  App    │
    └──────────┘  └──────────────┘  └─────────┘
```

## Components

### 1. Core Driver: `wt901c.py`

**Complete 9-axis IMU driver with all features:**

#### Data Structures
```python
@dataclass
class Accel:          # 0x51
    ax_g, ay_g, az_g: float  # ±16g
    temp_c: float

@dataclass
class Gyro:           # 0x52
    gx_dps, gy_dps, gz_dps: float  # ±2000°/s
    temp_c: float

@dataclass
class Angles:         # 0x53
    roll_deg, pitch_deg, yaw_deg: float  # ±180°
    temp_c: float

@dataclass
class Mag:            # 0x54
    mx, my, mz: int   # Raw magnetometer
    temp_c: float

@dataclass
class Quaternion:     # 0x59
    q0, q1, q2, q3: float  # Unit quaternion

@dataclass
class PressureAlt:    # 0x56
    pressure_pa: float
    altitude_m: float

@dataclass
class GPSData:        # 0x57 (GPS variant only)
    lon_deg, lat_deg: float
    gps_height_m, gps_yaw_deg: float
    ground_speed_kmh: float

@dataclass
class GPSAccuracy:    # 0x58 (GPS variant only)
    pdop, hdop, vdop: float
    num_satellites: int

@dataclass
class PortStatus:     # 0x5A (GPIO variant)
    d0, d1, d2, d3: int

@dataclass
class TimePacket:     # 0x50
    year, month, day: int
    hour, minute, second, millis: int
```

#### Basic Usage
```python
from back_end.hardware.imu.wt901c import WT901C, PID

# Initialize
imu = WT901C(port="/dev/ttyUSB1", baud=9600)
imu.start()

# Get latest data
accel = imu.last(PID.ACC)
gyro = imu.last(PID.GYRO)
angles = imu.last(PID.ANG)
mag = imu.last(PID.MAG)
quat = imu.last(PID.QUAT)

print(f"Orientation: Roll={angles.roll_deg}°, Pitch={angles.pitch_deg}°, Yaw={angles.yaw_deg}°")
print(f"Accel: X={accel.ax_g}g, Y={accel.ay_g}g, Z={accel.az_g}g")
print(f"Gyro: X={gyro.gx_dps}°/s, Y={gyro.gy_dps}°/s, Z={gyro.gz_dps}°/s")

imu.stop()
```

#### Callback Usage
```python
def handle_packet(pid: PID, packet):
    if pid == PID.ANG:
        print(f"Angles: {packet.roll_deg}, {packet.pitch_deg}, {packet.yaw_deg}")
    elif pid == PID.ACC:
        print(f"Accel: {packet.ax_g}, {packet.ay_g}, {packet.az_g}")

imu.on_packet(handle_packet)
imu.start()
# Callbacks fire automatically
time.sleep(10)
imu.stop()
```

### 2. Configuration

#### Basic Configuration
```python
# Set output rate
imu.set_output_rate_hz(50)  # 1-200 Hz

# Set output content (bitmask)
# bit0=ACC, bit1=GYRO, bit2=ANG, bit3=MAG, bit4=BARO, bit5=QUAT
imu.set_output_content_mask(0b00111111)  # All sensors

# Change baud rate
imu.set_baud_code(4)  # 0=9600, 1=19200, 2=38400, 3=57600, 4=115200
# Must reopen port after changing baud

# Save configuration to flash
imu.save_config()

# Reset device
imu.reset()
```

#### Advanced Configuration (NEW!)
```python
# Method 1: Manual unlock/lock
imu.unlock()  # Unlock configuration
imu.set_installation_direction(AXIS_DIR_HORIZONTAL)  # or AXIS_DIR_VERTICAL
imu.set_gyro_auto_calibration(True)  # Enable auto-cal on startup
imu.set_angle_reference('z')  # Zero yaw axis
imu.save_config()
imu.lock()  # Lock to prevent accidental changes

# Method 2: High-level helper (automatic unlock/lock)
imu.configure_advanced(
    rate_hz=100,
    content_mask=0b00111111,  # All sensors
    installation_dir=AXIS_DIR_HORIZONTAL,
    gyro_auto_cal=False  # Disable for dynamic applications
)
```

### 3. Calibration

#### Basic Calibration
```python
# Accelerometer (keep device still on level surface)
imu.start_accel_calibration()
time.sleep(5)
imu.stop_accel_calibration()

# Magnetometer (rotate device in figure-8 patterns)
imu.start_mag_calibration()
time.sleep(20)
imu.stop_mag_calibration()

# Save calibration
imu.save_config()
```

#### Advanced Calibration (NEW!)
```python
# Method 1: Full calibration with angle reference
imu.calibrate_with_config(
    accel=True,
    mag=True,
    angle_ref='z',  # Zero yaw after calibration
    duration=15
)
# Automatically handles unlock/save/lock

# Method 2: Individual calibrations
# Magnetometer only
imu.calibrate_with_config(mag=True, duration=20)

# Accelerometer only with Z-axis zeroing
imu.calibrate_with_config(accel=True, angle_ref='z', duration=5)
```

### 4. FastAPI Service: `wt901c_api.py`

**Complete HTTP/WebSocket API with all features:**

#### Starting the Server
```bash
# Basic
python -m back_end.hardware.imu.wt901c_api --host 0.0.0.0 --port 8080

# With custom serial port
IMU_PORT=/dev/ttyUSB1 IMU_BAUD=9600 \
python -m back_end.hardware.imu.wt901c_api --host 0.0.0.0 --port 8080
```

#### Key Endpoints

| Category | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| **Data** | `/health` | GET | Extended health check |
| | `/snapshot` | GET | Latest data from all sensors |
| | `/last/{name}` | GET | Latest single sensor (ang/gyro/acc/mag/etc) |
| | `/sse` | GET | Server-Sent Events stream |
| | `/ws` | WebSocket | WebSocket stream |
| | `/debug/stats` | GET | Packet rates and statistics |
| **Basic Config** | `/config/rate/{hz}` | POST | Set output rate |
| | `/config/baud/{code}` | POST | Set baud rate |
| | `/config/content/{mask}` | POST | Set output content mask |
| | `/save` | POST | Save config to flash |
| | `/reset` | POST | Reset device |
| **Advanced Config** | `/config/unlock` | POST | Unlock configuration |
| | `/config/lock` | POST | Lock configuration |
| | `/config/installation_direction/{dir}` | POST | Set mounting (horizontal/vertical) |
| | `/config/gyro_auto_cal/{enable}` | POST | Enable/disable gyro auto-cal |
| | `/config/angle_reference` | POST | Set angle zero point |
| | `/config/advanced` | POST | Multi-setting configuration |
| **Calibration** | `/calib/accel/{action}` | POST | Start/stop accel calibration |
| | `/calib/mag/{action}` | POST | Start/stop mag calibration |
| | `/calib/full` | POST | Full calibration sequence |

#### API Usage Examples

**Get Current Data:**
```bash
# Health check
curl http://localhost:8080/health

# Latest angles
curl http://localhost:8080/last/ang

# Snapshot of multiple sensors
curl "http://localhost:8080/snapshot?types=ang,acc,gyro"

# Stream with SSE
curl http://localhost:8080/sse
```

**Basic Configuration:**
```bash
# Set to 50 Hz
curl -X POST http://localhost:8080/config/rate/50

# Enable only ACC+GYRO+ANG (0b00000111 = 7)
curl -X POST http://localhost:8080/config/content/7

# Save configuration
curl -X POST http://localhost:8080/save
```

**Advanced Configuration:**
```bash
# Configure multiple settings at once (JSON body)
curl -X POST http://localhost:8080/config/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "rate_hz": 100,
    "content_mask": 63,
    "installation_direction": "horizontal",
    "gyro_auto_cal": false
  }'

# Manual configuration sequence
curl -X POST http://localhost:8080/config/unlock
curl -X POST http://localhost:8080/config/installation_direction/horizontal
curl -X POST http://localhost:8080/config/angle_reference?axis=z
curl -X POST http://localhost:8080/save
curl -X POST http://localhost:8080/config/lock
```

**Calibration:**
```bash
# Full calibration (mag for 20 seconds)
curl -X POST "http://localhost:8080/calib/full?mag=true&duration=20"

# Accelerometer + zero Z-axis
curl -X POST "http://localhost:8080/calib/full?accel=true&angle_ref=z&duration=5"

# Both sensors
curl -X POST "http://localhost:8080/calib/full?accel=true&mag=true&duration=15"
```

**WebSocket (JavaScript):**
```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    // msg.type: "ang", "acc", "gyro", etc.
    // msg.data: parsed sensor data
    // msg.ts: timestamp

    if (msg.type === "ang") {
        console.log(`Roll: ${msg.data.roll_deg}°`);
        console.log(`Pitch: ${msg.data.pitch_deg}°`);
        console.log(`Yaw: ${msg.data.yaw_deg}°`);
    }
};
```

## Hardware Setup

### Connections

**Raspberry Pi UART:**
- VCC → 3.3V or 5V (check device specs)
- GND → GND
- TX → GPIO 15 (RX)
- RX → GPIO 14 (TX)

**USB-Serial Adapter:**
- Connect TX/RX with crossover (TX→RX, RX→TX)
- Most WT901C modules appear as `/dev/ttyUSB0` or `/dev/ttyUSB1`

### Raspberry Pi Configuration

**Check Serial Port:**
```bash
# Find the device
ls -l /dev/ttyUSB* /dev/ttyAMA*

# Check device info
udevadm info -a -n /dev/ttyUSB1 | grep -E 'ATTRS{idVendor}|ATTRS{idProduct}'
```

**Add User to dialout Group:**
```bash
sudo usermod -a -G dialout $USER
# Re-login or:
sudo setfacl -m u:$USER:rw /dev/ttyUSB1
```

**Verify Communication:**
```bash
# View raw output
cat /dev/ttyUSB1

# Or use minicom
minicom -D /dev/ttyUSB1 -b 9600
```

## Performance & Specifications

| Parameter | Value |
|-----------|-------|
| **Accelerometer** | ±16g, 16-bit resolution |
| **Gyroscope** | ±2000°/s, 16-bit resolution |
| **Magnetometer** | 3-axis digital compass (MPU9250) |
| **Angle Accuracy** | X/Y: ±0.2°, Z: ±1° |
| **Output Rate** | 1-200 Hz (configurable) |
| **Baud Rates** | 9600, 19200, 38400, 57600, 115200 bps |
| **Protocol** | Binary (0x55 header), 11-byte frames |
| **Power** | 5V nominal |
| **Temperature Range** | -40°C to +85°C |

## Data Formats

### Accelerometer (0x51)
```json
{
  "type": "acc",
  "data": {
    "ax_g": 0.08,
    "ay_g": 0.03,
    "az_g": -1.0,
    "temp_c": 24.95,
    "_pid": "acc"
  },
  "ts": 12345.67
}
```

### Gyroscope (0x52)
```json
{
  "type": "gyro",
  "data": {
    "gx_dps": 0.15,
    "gy_dps": -0.30,
    "gz_dps": 0.05,
    "temp_c": 24.95,
    "_pid": "gyro"
  },
  "ts": 12345.67
}
```

### Angles (0x53)
```json
{
  "type": "ang",
  "data": {
    "roll_deg": 2.50,
    "pitch_deg": -1.20,
    "yaw_deg": 45.30,
    "_pid": "ang"
  },
  "ts": 12345.67
}
```

### Magnetometer (0x54)
```json
{
  "type": "mag",
  "data": {
    "mx": -1422,
    "my": -9035,
    "mz": 9754,
    "temp_c": 0.0,
    "_pid": "mag"
  },
  "ts": 12345.67
}
```

### Quaternion (0x59)
```json
{
  "type": "quat",
  "data": {
    "q0": 0.998,
    "q1": 0.009,
    "q2": -0.019,
    "q3": -0.058,
    "_pid": "quat"
  },
  "ts": 12345.67
}
```

### GPS (0x57) - GPS Variant Only
```json
{
  "type": "gps",
  "data": {
    "lon_deg": -122.4194,
    "lat_deg": 37.7749,
    "gps_height_m": 0.0,
    "gps_yaw_deg": 0.0,
    "ground_speed_kmh": 0.0,
    "_pid": "gps"
  },
  "ts": 12345.67
}
```

### GPS Accuracy (0x58) - GPS Variant Only
```json
{
  "type": "gps2",
  "data": {
    "pdop": 2.5,
    "hdop": 1.2,
    "vdop": 2.1,
    "num_satellites": 8,
    "_pid": "gps2"
  },
  "ts": 12345.67
}
```

## Command Protocol

### Command Structure
```
0xFF 0xAA <CMD> <ARG_LOW> <ARG_HIGH>
```

### Unlock/Lock Sequences
```python
# Unlock (required before most configuration changes)
UNLOCK = [0xFF, 0xAA, 0x69, 0x88, 0xB5]

# Lock (protects configuration from accidental changes)
LOCK = [0xFF, 0xAA, 0x6A, 0xB5, 0x88]
```

### Common Commands

| Command | Code | Arg | Description |
|---------|------|-----|-------------|
| SAVE | 0x00 | 0x00 | Save configuration to flash |
| CAL_ACCEL | 0x01 | 0x01/0x00 | Start/stop accel calibration |
| OUTPUT_CONTENT | 0x02 | mask | Set output packet mask |
| SET_RATE | 0x03 | Hz | Set output rate |
| SET_BAUD | 0x04 | code | Set baud rate |
| AXIS_DIR | 0x05 | 0x00/0x01 | Horizontal/vertical installation |
| RESET | 0x06 | 0x00 | Soft reset |
| CAL_MAG | 0x07 | 0x01/0x00 | Start/stop mag calibration |
| READ_REG | 0x27 | reg_addr | Read register value |
| UNLOCK | 0x69 | 0x88, 0xB5 | Unlock configuration |
| LOCK | 0x6A | 0xB5, 0x88 | Lock configuration |

## Use Cases & Examples

### Drone/Quadcopter
```python
# Configure for high-speed control loop
imu.configure_advanced(
    rate_hz=100,                # 100 Hz for fast updates
    content_mask=0b00111111,    # All sensors
    installation_dir=AXIS_DIR_HORIZONTAL,
    gyro_auto_cal=False        # Disable for dynamic flight
)

# Main loop
while flying:
    angles = imu.last(PID.ANG)
    gyro = imu.last(PID.GYRO)
    accel = imu.last(PID.ACC)

    # Use for stabilization
    pid_roll.update(angles.roll_deg, gyro.gx_dps)
    pid_pitch.update(angles.pitch_deg, gyro.gy_dps)
    pid_yaw.update(angles.yaw_deg, gyro.gz_dps)
```

### Robot Navigation
```python
# Configure for navigation
imu.configure_advanced(
    rate_hz=20,                 # 20 Hz sufficient for navigation
    content_mask=0b00001111,    # ACC+GYRO+ANG+MAG
    gyro_auto_cal=True         # Enable auto-cal when stationary
)

# Calibrate on startup
print("Calibrating... Keep robot still")
imu.calibrate_with_config(
    accel=True,
    mag=True,
    angle_ref='z',  # Zero yaw to current heading
    duration=10
)

# Navigation loop
while navigating:
    angles = imu.last(PID.ANG)
    heading = angles.yaw_deg
    navigate_to_target(heading)
```

### Motion Capture / VR
```python
# Use quaternions for smooth rotation tracking
imu.configure_advanced(
    rate_hz=200,                # Maximum rate for low latency
    content_mask=0b00100000,    # QUAT only (bit5)
    gyro_auto_cal=False        # Don't calibrate during motion
)

while True:
    quat = imu.last(PID.QUAT)
    if quat:
        # Convert to rotation matrix or Euler angles as needed
        update_3d_object_rotation(quat.q0, quat.q1, quat.q2, quat.q3)
```

### Tilt/Inclinometer
```python
# Simple angle monitoring
imu.configure_advanced(
    rate_hz=10,                 # 10 Hz sufficient for tilt monitoring
    content_mask=0b00000100,    # ANG only (bit2)
)

while True:
    angles = imu.last(PID.ANG)
    print(f"Tilt: Roll={angles.roll_deg:.1f}°, Pitch={angles.pitch_deg:.1f}°")

    if abs(angles.roll_deg) > 45 or abs(angles.pitch_deg) > 45:
        trigger_alarm("Excessive tilt detected!")

    time.sleep(0.1)
```

## Calibration Guide

### Accelerometer Calibration
1. Place IMU on a **perfectly level surface**
2. Keep device **completely still**
3. Run calibration for **5-10 seconds**
4. Save configuration

```python
# Method 1: API
curl -X POST "http://localhost:8080/calib/full?accel=true&duration=5"

# Method 2: Python
imu.calibrate_with_config(accel=True, duration=5)

# Method 3: Manual
imu.unlock()
imu.start_accel_calibration()
time.sleep(5)
imu.stop_accel_calibration()
imu.save_config()
imu.lock()
```

### Magnetometer Calibration
1. **Rotate device in ALL directions** (figure-8 patterns)
2. Cover full 3D rotation space
3. Run calibration for **20-30 seconds**
4. Avoid magnetic interference (metal, electronics)
5. Save configuration

```python
# Method 1: API
curl -X POST "http://localhost:8080/calib/full?mag=true&duration=20"

# Method 2: Python
imu.calibrate_with_config(mag=True, duration=20)
```

### Angle Reference (Zero Yaw)
Set current orientation as reference (useful for relative navigation):

```python
# Zero yaw axis (most common)
imu.unlock()
imu.set_angle_reference('z')
imu.save_config()
imu.lock()

# Or via API
curl -X POST "http://localhost:8080/config/angle_reference?axis=z"
```

## Troubleshooting

### No Data Received

**Check Serial Port:**
```bash
# List ports
ls -l /dev/ttyUSB* /dev/ttyAMA*

# Check permissions
sudo chmod 666 /dev/ttyUSB1

# View raw data
cat /dev/ttyUSB1
# Should see binary data streaming
```

**Check Baud Rate:**
```bash
# Try different baud rates
for baud in 9600 115200 57600 38400 19200; do
  echo "Testing $baud..."
  stty -F /dev/ttyUSB1 $baud
  timeout 2 cat /dev/ttyUSB1 | xxd | head -n 5
done
```

**Check Wiring:**
- TX → RX crossover correct?
- GND connected?
- Power LED on IMU lit?

### Incorrect Data / Jittering

**Calibrate Sensors:**
```python
# Full calibration
imu.calibrate_with_config(accel=True, mag=True, angle_ref='z', duration=15)
```

**Check Mounting:**
- Is device vibrating?
- Secure mounting?
- Correct installation direction set?

**Check Update Rate:**
- Too fast for application? Try lower rate
- Too slow? Increase rate (up to 200 Hz)

### Angles Drifting

**Gyroscope Drift:**
- Enable auto-calibration: `imu.set_gyro_auto_calibration(True)`
- Calibrate when stationary
- Magnetometer helps correct yaw drift

**Temperature Effects:**
- Allow IMU to warm up before calibration
- Monitor temperature sensor

### API Connection Issues

**Port Already in Use:**
```bash
# Find process using port 8080
sudo lsof -i:8080
# Or kill it
sudo fuser -k 8080/tcp
```

**Serial Port Busy:**
```bash
# Check what's using the port
lsof /dev/ttyUSB1
# Kill it if needed
sudo fuser -k /dev/ttyUSB1
```

## Best Practices

1. **Always calibrate** before first use
2. **Save configuration** after setup
3. **Lock configuration** in production to prevent accidental changes
4. **Use appropriate update rate** for your application
5. **Enable only needed sensors** to reduce bandwidth
6. **Monitor temperature** for temperature-sensitive applications
7. **Use quaternions** for 3D rotation to avoid gimbal lock
8. **Zero yaw angle** after placing device in known orientation
9. **Keep away from magnetic interference** for accurate compass readings
10. **Secure mounting** to reduce vibration noise

## Dependencies

```bash
pip install pyserial fastapi uvicorn
```

## Files

| File | Purpose |
|------|---------|
| `wt901c.py` | Core driver (100% complete) |
| `wt901c_api.py` | FastAPI REST/WebSocket service |
| `IMU_API.md` | Original API documentation |
| `WT901C_ENHANCEMENTS.md` | Enhancement summary |
| `WT901C_COMPLETE_GUIDE.md` | This file |

## Additional Resources

- **Official Wiki**: https://wiki.wit-motion.com/english
- **Product Page**: https://www.wit-motion.com/
- **Datasheet**: Available on product pages
- **Community**: https://github.com/topics/witmotion

## Summary

Your WT901C library is now **100% complete** with:

✅ **All sensor data**: ACC, GYRO, ANG, MAG, QUAT, BARO, TIME
✅ **GPS support**: Position and accuracy (GPS variant)
✅ **Digital I/O**: Port status monitoring
✅ **Complete configuration**: Rate, baud, content mask, save, reset
✅ **Advanced features**: Unlock/lock, installation direction, gyro auto-cal, angle reference
✅ **Calibration helpers**: One-command calibration with automatic lock handling
✅ **Production-ready API**: FastAPI with all endpoints, streaming, Swagger docs
✅ **Comprehensive documentation**: This guide + API docs + enhancement summary

The implementation is **production-ready** and suitable for:
- Drones and quadcopters
- Robots and autonomous vehicles
- Motion capture and VR
- Tilt sensors and inclinometers
- Any application requiring 9-axis IMU data

For interactive API documentation, visit `http://localhost:8080/docs` after starting the FastAPI service!
