# GPS Module Library

Complete implementation for SEQURE M10-25Q GPS + Compass module.

## Quick Start

### Install Dependencies
```bash
pip install pyserial smbus2 fastapi uvicorn
```

### Basic Usage

**Unified Module (GPS + Compass):**
```python
from back_end.hardware.gps.m10_25q import M10_25Q

module = M10_25Q()
module.start()

data = module.get_all_data()
print(f"Position: {data['gps']['lat']}, {data['gps']['lon']}")
print(f"Heading: {data['compass']['heading']}°")
print(f"Satellites: {len(data['satellites'])}")

module.stop()
```

**GPS Only:**
```python
from back_end.hardware.gps.m10_gps import M10GPS

gps = M10GPS(port="/dev/ttyAMA0", baud=115200)
gps.start()
fix = gps.get_latest_fix()
print(f"Lat: {fix['lat']}, Lon: {fix['lon']}, Sats: {fix['sats']}")
gps.stop()
```

**Compass Only:**
```python
from back_end.hardware.gps.qmc5883l import QMC5883L

compass = QMC5883L(i2c_bus=1)
compass.start()
data = compass.get_magnetometer()
print(f"Heading: {data['heading']}°")
compass.stop()
```

### Start API Server
```bash
python -m back_end.hardware.gps.m10_25q_api --host 0.0.0.0 --port 8083
```
Visit http://localhost:8083/docs for interactive API documentation.

### Test Tools
```bash
# Test GPS only
python -m back_end.hardware.gps.gps_cli

# Test compass
python -m back_end.hardware.gps.compass_test

# Test complete module
python -m back_end.hardware.gps.m10_25q_test

# Calibrate compass
python -m back_end.hardware.gps.compass_test --calibrate 30
```

## File Structure

```
back_end/hardware/gps/
├── README.md                      # This file
├── M10_25Q_COMPLETE_GUIDE.md     # Comprehensive documentation
│
├── qmc5883l.py                   # QMC5883L compass driver
├── m10_gps.py                    # Enhanced M10 GPS driver
├── m10_25q.py                    # Unified GPS+Compass driver
│
├── m10_25q_api.py                # FastAPI service
├── m10_api.py                    # GPS-only API service
│
├── compass_test.py               # Compass CLI test tool
├── m10_25q_test.py               # Complete module CLI tool
└── gps_cli.py                    # GPS-only CLI tool
```

## Features

### GPS (u-blox M10)
- ✅ Multi-GNSS: GPS, GLONASS, Galileo, BeiDou, QZSS, SBAS
- ✅ NMEA and UBX protocol support
- ✅ Position, velocity, time
- ✅ Extended data: DOP values, navigation status, satellite info
- ✅ Configurable update rate (1-10 Hz)
- ✅ Flash configuration persistence

### Compass (QMC5883L)
- ✅ 3-axis magnetometer
- ✅ Heading calculation (0-360°)
- ✅ Hard/soft iron calibration
- ✅ Magnetic declination correction
- ✅ High update rate (up to 200 Hz)
- ✅ Temperature sensor

### APIs & Tools
- ✅ FastAPI REST/WebSocket service
- ✅ Server-Sent Events (SSE) streaming
- ✅ CLI test tools
- ✅ Interactive calibration
- ✅ Comprehensive diagnostics

## Hardware Setup

**Connections:**
- GPS UART: `/dev/ttyAMA0` @ 115200 baud
- Compass I2C: Bus 1, Address 0x0D

**Enable UART & I2C on Raspberry Pi:**
```bash
# Enable UART in /boot/config.txt
enable_uart=1
dtoverlay=disable-bt

# Enable I2C
sudo raspi-config  # Interface Options → I2C → Enable
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /status` | Complete module status |
| `GET /gps` | GPS fix data |
| `GET /compass` | Compass data |
| `GET /position` | Position (lat, lon, alt) |
| `GET /heading` | Compass heading |
| `GET /satellites` | Satellite information |
| `GET /dop` | DOP values |
| `GET /diagnostics` | Diagnostics |
| `GET /sse` | Server-Sent Events stream |
| `WS /ws` | WebSocket stream |
| `POST /config/*` | Configuration endpoints |

## Data Structures

**GPS Fix:**
```python
{
    "lat": 47.123456,      # Latitude (degrees)
    "lon": -122.234567,    # Longitude (degrees)
    "alt_m": 125.3,        # Altitude (meters)
    "fix": 3,              # Fix type (0-5)
    "sats": 12,            # Satellite count
    "hdop": 0.8,           # Horizontal DOP
    "speed_mps": 15.5,     # Speed (m/s)
    "course_deg": 145.2    # Course (degrees)
}
```

**Compass:**
```python
{
    "heading": 187.3,      # 0-360° (0=North)
    "x": 23.5,             # X-axis (µT)
    "y": -15.2,            # Y-axis (µT)
    "z": 45.8,             # Z-axis (µT)
    "magnitude": 52.1      # Total field (µT)
}
```

## Calibration

**Compass calibration is required for accurate heading!**

```bash
python -m back_end.hardware.gps.compass_test --calibrate 30
```

Or programmatically:
```python
compass.calibrate_interactive(30)
```

Set magnetic declination for true north:
```python
module.set_magnetic_declination(12.5)  # degrees
# Find yours: https://www.magnetic-declination.com/
```

## Documentation

See [M10_25Q_COMPLETE_GUIDE.md](M10_25Q_COMPLETE_GUIDE.md) for:
- Detailed API documentation
- Hardware setup instructions
- Calibration procedures
- Troubleshooting guide
- Integration examples
- Performance specifications

## Module Specifications

**SEQURE M10-25Q:**
- Size: 25×25×8mm
- Weight: 12.2g
- GPS Chip: u-blox M10
- Compass: QMC5883L
- Frequency: GPS L1, GLONASS L1, BDS B1, Galileo E1, SBAS, QZSS
- Channels: 72 search channels
- Position Accuracy: 1.5m (2D)
- Update Rate: 1-10Hz (default 10Hz)
- Power: 5V
- Interfaces: UART (GPS) + I2C (Compass)

## Troubleshooting

**No GPS data:**
- Check `/dev/ttyAMA0` exists
- Verify UART enabled in `/boot/config.txt`
- Try autobaud: `gps.autobaud()`
- Check wiring (TX/RX may be swapped)

**No compass data:**
- Run `sudo i2cdetect -y 1` (should see 0x0D)
- Check I2C enabled in raspi-config
- Verify wiring (SDA/SCL)

**Poor accuracy:**
- Calibrate compass
- Wait for good fix (`hdop < 2`, `sats >= 8`)
- Ensure clear sky view
- Set magnetic declination

## Examples

See the test tools for complete examples:
- [compass_test.py](compass_test.py) - Compass examples
- [m10_25q_test.py](m10_25q_test.py) - Complete module examples

## Support

Product Page: https://sequremall.com/products/sequre-gps-small-size-fast-positioning-drone-fpv-return-qmc5883l-compass

Documentation: See [M10_25Q_COMPLETE_GUIDE.md](M10_25Q_COMPLETE_GUIDE.md)
