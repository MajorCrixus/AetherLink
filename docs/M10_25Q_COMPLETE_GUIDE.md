# SEQURE M10-25Q Complete Implementation Guide

## Overview

This is a complete, production-ready implementation for the SEQURE M10-25Q GPS Module, providing full access to all module capabilities:

- **GPS**: u-blox M10 chipset with multi-GNSS support (GPS, GLONASS, Galileo, BeiDou, QZSS, SBAS)
- **Compass**: QMC5883L 3-axis magnetometer for heading/orientation
- **Advanced Features**: Satellite diagnostics, DOP values, navigation status

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     M10-25Q Module                           │
├──────────────────────────┬───────────────────────────────────┤
│    u-blox M10 GPS        │    QMC5883L Compass               │
│    (UART @ 115200)       │    (I2C @ 0x0D)                   │
└──────────┬───────────────┴──────────┬────────────────────────┘
           │                          │
           ▼                          ▼
     ┌──────────┐              ┌──────────────┐
     │ m10_gps  │              │  qmc5883l    │
     │  .py     │              │    .py       │
     └────┬─────┘              └──────┬───────┘
          │                           │
          └───────────┬───────────────┘
                      ▼
              ┌──────────────┐
              │  m10_25q.py  │  ← Unified Driver
              └──────┬───────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐ ┌──────────┐ ┌─────────┐
   │ CLI     │ │ FastAPI  │ │  Your   │
   │ Tools   │ │ Service  │ │  App    │
   └─────────┘ └──────────┘ └─────────┘
```

## Components

### 1. Low-Level Drivers

#### `qmc5883l.py` - Compass Driver
Full-featured QMC5883L magnetometer driver with:
- Continuous reading mode at up to 200Hz
- Heading calculation (0-360°)
- Hard/soft iron calibration
- Magnetic declination correction
- Temperature sensor
- All control registers exposed

**Basic Usage:**
```python
from back_end.hardware.gps.qmc5883l import QMC5883L

compass = QMC5883L(i2c_bus=1, address=0x0D)
compass.set_declination(12.5)  # Set your local declination
compass.start()

data = compass.get_magnetometer()
print(f"Heading: {data['heading']}°")
print(f"Magnetic field: X={data['x']}, Y={data['y']}, Z={data['z']} µT")

compass.stop()
```

**Calibration:**
```python
# Interactive calibration (rotate in all directions for 30 seconds)
calib = compass.calibrate_interactive(30)

# Apply calibration
compass.set_calibration(
    offset_x=calib['offset_x'],
    offset_y=calib['offset_y'],
    offset_z=calib['offset_z'],
    scale_x=calib['scale_x'],
    scale_y=calib['scale_y'],
    scale_z=calib['scale_z']
)
```

#### `m10_gps.py` - GPS Driver (Enhanced)
Enhanced u-blox M10 GPS driver with:
- NMEA and UBX protocol support
- Position, velocity, time data
- Extended UBX messages:
  - NAV-PVT: Position, Velocity, Time
  - NAV-DOP: All dilution of precision values (GDOP, PDOP, HDOP, VDOP, etc.)
  - NAV-STATUS: Navigation status and health
  - NAV-SAT: Detailed satellite information
- Configuration: baud rate, update rate, message selection
- Flash persistence

**Basic Usage:**
```python
from back_end.hardware.gps.m10_gps import M10GPS

gps = M10GPS(port="/dev/ttyAMA0", baud=115200)
gps.start()

# Enable extended messages
gps.open()
gps.enable_ubx_messages(nav_dop=True, nav_status=True, nav_sat=True)
gps.close()

# Get data
fix = gps.get_latest_fix()
print(f"Position: {fix['lat']}, {fix['lon']}")
print(f"Satellites: {fix['sats']}, Fix: {fix['fix']}")

extended = gps.get_extended_data()
print(f"HDOP: {extended['dop']['hdop']}")
print(f"Satellites: {len(extended['satellites'])}")

gps.stop()
```

### 2. Unified Driver

#### `m10_25q.py` - Complete Module Driver
Combines GPS and compass into single interface:

```python
from back_end.hardware.gps.m10_25q import M10_25Q

module = M10_25Q(
    uart_port="/dev/ttyAMA0",
    uart_baud=115200,
    i2c_bus=1,
    i2c_addr=0x0D,
    enable_extended_gps=True
)

module.set_magnetic_declination(12.5)  # Optional
module.start()

# Get all data
data = module.get_all_data()
print(f"GPS: {data['gps']['lat']}, {data['gps']['lon']}")
print(f"Compass: {data['compass']['heading']}°")
print(f"Satellites: {len(data['satellites'])}")
print(f"HDOP: {data['dop']['hdop']}")

# Or get specific data
pos = module.get_position()  # (lat, lon, alt)
heading = module.get_heading()  # degrees
sat_count = module.get_satellite_count()

# Diagnostics
diag = module.get_diagnostics()
module.print_status()  # Human-readable output

module.stop()
```

### 3. FastAPI Service

#### `m10_25q_api.py` - REST/WebSocket API
Complete HTTP/WebSocket API with:
- Real-time data streaming (SSE, WebSocket)
- Configuration endpoints
- Diagnostics and monitoring
- Swagger/OpenAPI documentation

**Starting the Server:**
```bash
python -m back_end.hardware.gps.m10_25q_api \
  --host 0.0.0.0 \
  --port 8083 \
  --gps-port /dev/ttyAMA0 \
  --gps-baud 115200 \
  --i2c-bus 1 \
  --i2c-addr 0x0D
```

**Key Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/status` | GET | Complete module status |
| `/gps` | GET | GPS fix data |
| `/compass` | GET | Compass data |
| `/position` | GET | Position (lat, lon, alt) |
| `/heading` | GET | Compass heading |
| `/satellites` | GET | Satellite information |
| `/dop` | GET | DOP values |
| `/diagnostics` | GET | Comprehensive diagnostics |
| `/sse` | GET | Server-Sent Events stream |
| `/ws` | WebSocket | WebSocket stream |
| `/config/gps_rate/{hz}` | POST | Set GPS update rate |
| `/config/declination/{deg}` | POST | Set magnetic declination |
| `/config/calibrate_compass` | POST | Run compass calibration |
| `/config/save` | POST | Save GPS config to flash |
| `/docs` | GET | Interactive API documentation |

**Example API Requests:**
```bash
# Get current status
curl http://localhost:8083/status

# Get position
curl http://localhost:8083/position

# Set GPS to 5 Hz
curl -X POST http://localhost:8083/config/gps_rate/5

# Set declination
curl -X POST http://localhost:8083/config/declination/12.5

# Stream data with SSE
curl http://localhost:8083/sse

# WebSocket (JavaScript)
const ws = new WebSocket('ws://localhost:8083/ws');
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('GPS:', data.data.gps);
    console.log('Compass:', data.data.compass);
};
```

### 4. CLI Test Tools

#### `compass_test.py` - Compass Testing
```bash
# Continuous reading
python -m back_end.hardware.gps.compass_test

# Single reading
python -m back_end.hardware.gps.compass_test --once

# Calibration (30 seconds)
python -m back_end.hardware.gps.compass_test --calibrate 30

# Custom I2C settings
python -m back_end.hardware.gps.compass_test --bus 1 --addr 0x0D
```

#### `m10_25q_test.py` - Complete Module Testing
```bash
# Continuous status
python -m back_end.hardware.gps.m10_25q_test

# Single reading with details
python -m back_end.hardware.gps.m10_25q_test --once

# JSON output
python -m back_end.hardware.gps.m10_25q_test --json

# Satellite view
python -m back_end.hardware.gps.m10_25q_test --satellites

# Diagnostics
python -m back_end.hardware.gps.m10_25q_test --diagnostics

# Custom settings
python -m back_end.hardware.gps.m10_25q_test \
  --gps-port /dev/ttyUSB0 \
  --gps-baud 115200 \
  --i2c-bus 1 \
  --declination 12.5
```

## Data Structures

### GPS Fix Data
```python
{
    "time_utc": "2025-10-11T14:30:45Z",  # UTC timestamp
    "lat": 47.123456,                     # Latitude (degrees)
    "lon": -122.234567,                   # Longitude (degrees)
    "alt_m": 125.3,                       # Altitude MSL (meters)
    "fix": 3,                             # 0=none, 1=DR, 2=2D, 3=3D, 4=GPS+DR, 5=time
    "sats": 12,                           # Satellites in use
    "hdop": 0.8,                          # Horizontal DOP
    "speed_mps": 15.5,                    # Speed (m/s)
    "course_deg": 145.2,                  # Course over ground (degrees)
    "source": "UBX"                       # "NMEA" or "UBX"
}
```

### Compass Data
```python
{
    "x": 23.5,              # X-axis magnetic field (µT)
    "y": -15.2,             # Y-axis magnetic field (µT)
    "z": 45.8,              # Z-axis magnetic field (µT)
    "heading": 187.3,       # Heading 0-360° (0=N, 90=E, 180=S, 270=W)
    "magnitude": 52.1,      # Total field strength (µT)
    "temperature": 25.3,    # Temperature (°C, needs calibration)
    "status": 0x01,         # Status register
    "timestamp": 1696789123.456
}
```

### DOP Values
```python
{
    "gdop": 1.2,   # Geometric DOP
    "pdop": 1.0,   # Position DOP
    "tdop": 0.5,   # Time DOP
    "vdop": 0.8,   # Vertical DOP
    "hdop": 0.7,   # Horizontal DOP
    "ndop": 0.6,   # Northing DOP
    "edop": 0.5,   # Easting DOP
    "timestamp": 1696789123.456
}
```

### Satellite Information
```python
[
    {
        "gnss": "GPS",           # GPS, GLONASS, Galileo, BeiDou, QZSS, SBAS
        "sv_id": 23,             # Satellite ID
        "cno": 45,               # Carrier-to-noise ratio (dBHz)
        "elevation": 35,         # Elevation angle (degrees)
        "azimuth": 180,          # Azimuth angle (degrees)
        "pr_res": 0.5,           # Pseudorange residual (meters)
        "quality": 7,            # Signal quality (0-7)
        "used": True,            # Used in navigation solution
        "health": "healthy",     # "healthy", "unhealthy", "unknown"
        "diff_corr": False,      # Differential correction available
        "smoothed": True         # Carrier smoothed pseudorange
    },
    # ... more satellites
]
```

## Hardware Setup

### Connections

**GPS (UART):**
- TX → Raspberry Pi RX (GPIO 15)
- RX → Raspberry Pi TX (GPIO 14)
- VCC → 5V
- GND → GND

**Compass (I2C - shared with GPS module):**
- SDA → Raspberry Pi SDA (GPIO 2)
- SCL → Raspberry Pi SCL (GPIO 3)
- Uses GPS module's power (5V)

### Raspberry Pi Configuration

1. **Enable UART:**
```bash
# Edit /boot/config.txt
sudo nano /boot/config.txt

# Add:
enable_uart=1
dtoverlay=disable-bt
```

2. **Enable I2C:**
```bash
sudo raspi-config
# Interface Options → I2C → Enable
```

3. **Verify:**
```bash
# Check UART
ls -l /dev/ttyAMA0

# Check I2C
sudo i2cdetect -y 1
# Should show 0x0D for QMC5883L
```

## Calibration

### Compass Calibration
The compass requires calibration for accurate heading measurements due to hard-iron (fixed magnetic field) and soft-iron (induced magnetic field) distortion.

**Method 1: Interactive CLI**
```bash
python -m back_end.hardware.gps.compass_test --calibrate 30
```
Rotate the module in figure-8 patterns in all three axes for 30 seconds.

**Method 2: Programmatic**
```python
compass = QMC5883L(i2c_bus=1)
compass.start()
calib = compass.calibrate_interactive(30)
# Save these values for later use
print(calib)
```

**Method 3: Manual**
Collect min/max values for each axis, then calculate:
```python
offset_x = -(max_x + min_x) / 2
offset_y = -(max_y + min_y) / 2
offset_z = -(max_z + min_z) / 2

avg_range = (max_x - min_x + max_y - min_y + max_z - min_z) / 3
scale_x = avg_range / (max_x - min_x)
scale_y = avg_range / (max_y - min_y)
scale_z = avg_range / (max_z - min_z)
```

### Magnetic Declination
Set your local magnetic declination for true north heading:
```python
# Find your declination: https://www.magnetic-declination.com/
module.set_magnetic_declination(12.5)  # degrees
```

## Performance

### GPS Performance
- **Update Rate**: 1-10 Hz (configurable)
- **Position Accuracy**: 1.5m CEP (open sky)
- **Speed Accuracy**: 0.05 m/s
- **Time to First Fix**: ~26s cold start, ~2s hot start
- **Sensitivity**: -162 dBm tracking

### Compass Performance
- **Update Rate**: 10-200 Hz (configurable)
- **Resolution**: 2 mGauss
- **Heading Accuracy**: ±2° (after calibration)
- **Magnetic Field Range**: ±8 Gauss (800 µT)

## Dependencies

```bash
pip install pyserial smbus2 fastapi uvicorn
```

## Troubleshooting

### GPS Issues

**No data from GPS:**
1. Check UART is enabled: `ls -l /dev/ttyAMA0`
2. Check wiring (TX/RX might be swapped)
3. Try autobaud detection:
   ```python
   gps.autobaud()
   ```
4. Check with `gpsd` or `minicom` to verify serial data

**Poor GPS accuracy:**
1. Ensure outdoor location with clear sky view
2. Wait for more satellites: `fix['sats'] >= 8`
3. Check HDOP: `fix['hdop'] < 2.0` is good
4. Check DOP values: lower is better

### Compass Issues

**Compass not detected:**
1. Check I2C is enabled: `sudo i2cdetect -y 1`
2. Should see device at 0x0D
3. Check wiring (SDA/SCL)
4. Try: `sudo i2cdetect -y 1` to scan

**Erratic heading:**
1. Calibrate the compass (required!)
2. Keep away from magnetic interference
3. Check magnitude is reasonable (20-60 µT typical)
4. Apply local magnetic declination

**Heading stuck or incorrect:**
1. Perform calibration
2. Module must be level for accurate heading
3. Check temperature isn't affecting readings

## Best Practices

1. **Always calibrate compass** before deployment
2. **Set magnetic declination** for your location
3. **Wait for good fix** before using position (`fix >= 3`, `hdop < 2`)
4. **Use extended UBX messages** for diagnostics
5. **Save GPS config** to flash after setup
6. **Handle compass errors** gracefully (I2C can fail)
7. **Monitor satellite count** for quality assessment
8. **Log DOP values** for quality control

## Integration Example

```python
from back_end.hardware.gps.m10_25q import M10_25Q
import time

# Initialize
module = M10_25Q(
    uart_port="/dev/ttyAMA0",
    uart_baud=115200,
    i2c_bus=1,
    enable_extended_gps=True
)

# Configure
module.set_magnetic_declination(12.5)  # Your location
module.set_gps_rate(5)  # 5 Hz updates
module.start()

# Wait for good fix
print("Waiting for GPS fix...")
while True:
    if module.has_fix():
        diag = module.get_diagnostics()
        if diag['gps']['hdop'] < 2.0:
            print("Good fix acquired!")
            break
    time.sleep(1)

# Main loop
try:
    while True:
        data = module.get_all_data()

        # Position
        gps = data['gps']
        print(f"Position: {gps['lat']:.6f}, {gps['lon']:.6f}")
        print(f"Altitude: {gps['alt_m']:.1f}m")

        # Heading
        compass = data['compass']
        print(f"Heading: {compass['heading']:.1f}°")

        # Quality
        print(f"Satellites: {gps['sats']}, HDOP: {gps['hdop']:.2f}")

        time.sleep(0.2)  # 5 Hz

except KeyboardInterrupt:
    print("\nShutting down...")
finally:
    module.stop()
```

## API Documentation

Full API documentation is available at `/docs` when running the FastAPI server:
```bash
python -m back_end.hardware.gps.m10_25q_api
# Visit: http://localhost:8083/docs
```

## License & Support

This implementation is part of the AetherLink project.

For issues or questions:
1. Check this documentation
2. Review troubleshooting section
3. Check module datasheets:
   - u-blox M10 Integration Manual
   - QMC5883L Datasheet

## Summary

You now have **complete, production-ready access** to all capabilities of the SEQURE M10-25Q module:

✅ GPS position, velocity, time
✅ Compass heading and magnetic field
✅ Satellite diagnostics (signal strength, usage, health)
✅ DOP values (all types)
✅ Navigation status monitoring
✅ Configuration and calibration
✅ REST API and WebSocket streaming
✅ CLI tools for testing
✅ Comprehensive documentation

The implementation is modular, well-tested, and ready for integration into your application!
