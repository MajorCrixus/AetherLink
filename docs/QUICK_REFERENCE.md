# M10-25Q Quick Reference Card

## Installation
```bash
pip install pyserial smbus2 fastapi uvicorn
```

## 30-Second Quick Start
```python
from back_end.hardware.gps.m10_25q import M10_25Q

module = M10_25Q()
module.start()

# Get all data
data = module.get_all_data()
print(data['gps'])      # GPS fix
print(data['compass'])  # Compass heading
print(data['dop'])      # DOP values
print(data['satellites'])  # Satellite info

module.stop()
```

## Common Tasks

### Get Position
```python
pos = module.get_position()  # (lat, lon, alt)
if pos:
    lat, lon, alt = pos
    print(f"{lat}, {lon} @ {alt}m")
```

### Get Heading
```python
heading = module.get_heading()  # 0-360°
print(f"Heading: {heading}°")
```

### Check GPS Quality
```python
if module.has_fix():
    sats = module.get_satellite_count()
    fix = module.get_gps_fix()
    print(f"{sats} sats, HDOP: {fix['hdop']}")
```

### Configure
```python
# Set GPS update rate
module.set_gps_rate(5)  # 5 Hz

# Set magnetic declination (find yours at magnetic-declination.com)
module.set_magnetic_declination(12.5)  # degrees

# Calibrate compass (rotate in all directions for 30s)
calib = module.calibrate_compass(30)

# Save GPS config to flash
module.save_gps_config()
```

## API Server
```bash
# Start server
python -m back_end.hardware.gps.m10_25q_api --port 8083

# Access docs
open http://localhost:8083/docs
```

### Key API Calls
```bash
# Get status
curl http://localhost:8083/status

# Get position
curl http://localhost:8083/position

# Get heading
curl http://localhost:8083/heading

# Stream data (SSE)
curl http://localhost:8083/sse

# Set GPS rate to 5 Hz
curl -X POST http://localhost:8083/config/gps_rate/5
```

## CLI Tools

### Test GPS
```bash
python -m back_end.hardware.gps.gps_cli
```

### Test Compass
```bash
# Continuous reading
python -m back_end.hardware.gps.compass_test

# Calibrate (rotate for 30 seconds)
python -m back_end.hardware.gps.compass_test --calibrate 30
```

### Test Complete Module
```bash
# Status display
python -m back_end.hardware.gps.m10_25q_test

# Detailed view
python -m back_end.hardware.gps.m10_25q_test --once

# Satellite info
python -m back_end.hardware.gps.m10_25q_test --satellites

# JSON output
python -m back_end.hardware.gps.m10_25q_test --json
```

## Hardware Connections

### Raspberry Pi
```
GPS (UART):
  TX  → GPIO 15 (RX)
  RX  → GPIO 14 (TX)
  VCC → 5V
  GND → GND

Compass (I2C):
  SDA → GPIO 2 (SDA)
  SCL → GPIO 3 (SCL)
  (Shares GPS power)
```

### Enable Interfaces
```bash
# /boot/config.txt
enable_uart=1
dtoverlay=disable-bt

# Enable I2C
sudo raspi-config  # → Interface Options → I2C → Enable
```

### Verify
```bash
# UART
ls -l /dev/ttyAMA0

# I2C (should see 0x0D)
sudo i2cdetect -y 1
```

## Data Structure Cheat Sheet

### GPS Fix (`get_gps_fix()`)
```python
{
    "lat": float,         # Latitude (-90 to 90)
    "lon": float,         # Longitude (-180 to 180)
    "alt_m": float,       # Altitude MSL (meters)
    "fix": int,           # 0=none, 1=DR, 2=2D, 3=3D, 4=GPS+DR, 5=time
    "sats": int,          # Satellite count
    "hdop": float,        # Horizontal DOP (lower=better)
    "speed_mps": float,   # Speed (m/s)
    "course_deg": float,  # Course (0-360°)
    "time_utc": str,      # ISO timestamp
    "source": str         # "NMEA" or "UBX"
}
```

### Compass (`get_compass_data()`)
```python
{
    "heading": float,     # 0-360° (0=N, 90=E, 180=S, 270=W)
    "x": float,           # X-axis magnetic field (µT)
    "y": float,           # Y-axis magnetic field (µT)
    "z": float,           # Z-axis magnetic field (µT)
    "magnitude": float,   # Total field strength (µT)
    "temperature": float  # °C (needs calibration)
}
```

### DOP Values (`get_extended_gps_data()['dop']`)
```python
{
    "gdop": float,  # Geometric DOP
    "pdop": float,  # Position DOP
    "hdop": float,  # Horizontal DOP  ← Most important
    "vdop": float,  # Vertical DOP
    "tdop": float,  # Time DOP
    "ndop": float,  # Northing DOP
    "edop": float   # Easting DOP
}
# Lower is better. HDOP < 2 is good.
```

### Satellites (`get_extended_gps_data()['satellites']`)
```python
[{
    "gnss": str,       # "GPS", "GLONASS", "Galileo", "BeiDou", etc.
    "sv_id": int,      # Satellite ID
    "cno": int,        # Signal strength (dBHz)
    "elevation": int,  # Elevation angle (degrees)
    "azimuth": int,    # Azimuth angle (degrees)
    "used": bool,      # Used in solution
    "health": str      # "healthy", "unhealthy", "unknown"
}, ...]
```

## Common Patterns

### Wait for Good Fix
```python
import time

module.start()
print("Waiting for GPS fix...")

while True:
    if module.has_fix():
        diag = module.get_diagnostics()
        if diag['gps']['hdop'] < 2.0:
            print("Good fix!")
            break
    time.sleep(1)
```

### Navigation Loop
```python
while True:
    pos = module.get_position()
    heading = module.get_heading()
    velocity = module.get_velocity()

    if pos and heading:
        lat, lon, alt = pos
        speed, course = velocity
        print(f"At {lat:.6f}, {lon:.6f} heading {heading:.1f}° @ {speed:.1f}m/s")

    time.sleep(0.2)  # 5 Hz
```

### Quality Check
```python
def check_quality(module):
    diag = module.get_diagnostics()
    gps = diag['gps']

    if not gps['has_fix']:
        return "NO_FIX"
    elif gps['satellites'] < 6:
        return "POOR"
    elif gps['hdop'] > 2.0:
        return "FAIR"
    else:
        return "GOOD"
```

## Troubleshooting Checklist

### GPS Not Working
- [ ] UART enabled? `ls -l /dev/ttyAMA0`
- [ ] Bluetooth disabled? (`dtoverlay=disable-bt`)
- [ ] Wiring correct? (TX→RX, RX→TX)
- [ ] Clear sky view?
- [ ] Waited 30s for cold start?

### Compass Not Working
- [ ] I2C enabled? `sudo raspi-config`
- [ ] Device detected? `sudo i2cdetect -y 1` shows 0x0D
- [ ] Wiring correct? (SDA→SDA, SCL→SCL)
- [ ] Compass calibrated?

### Poor Accuracy
- [ ] Compass calibrated? (Required!)
- [ ] HDOP < 2?
- [ ] Satellites ≥ 8?
- [ ] Magnetic declination set?
- [ ] Away from magnetic interference?

## Useful Commands

```bash
# View GPS NMEA output
cat /dev/ttyAMA0

# Test GPS with minicom
minicom -D /dev/ttyAMA0 -b 115200

# Scan I2C bus
sudo i2cdetect -y 1

# Check GPIO
gpio readall

# Monitor API logs
python -m back_end.hardware.gps.m10_25q_api 2>&1 | tee gps.log
```

## Performance Specs

| Parameter | Value |
|-----------|-------|
| Position Accuracy | 1.5m (2D, open sky) |
| Speed Accuracy | 0.05 m/s |
| Heading Accuracy | ±2° (calibrated) |
| GPS Update Rate | 1-10 Hz (configurable) |
| Compass Update Rate | 10-200 Hz (configurable) |
| Cold Start TTFF | ~26 seconds |
| Hot Start TTFF | ~2 seconds |
| Satellites | Up to 72 channels |

## Files

| File | Purpose |
|------|---------|
| `m10_25q.py` | Unified driver (GPS + Compass) |
| `m10_gps.py` | GPS driver only |
| `qmc5883l.py` | Compass driver only |
| `m10_25q_api.py` | FastAPI server |
| `m10_25q_test.py` | CLI test tool |
| `M10_25Q_COMPLETE_GUIDE.md` | Full documentation |

## Get Magnetic Declination
https://www.magnetic-declination.com/

Enter your location → Get declination → Set in code:
```python
module.set_magnetic_declination(12.5)  # Replace with your value
```

## WebSocket Example (JavaScript)
```javascript
const ws = new WebSocket('ws://localhost:8083/ws');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const gps = data.data.gps;
    const compass = data.data.compass;

    console.log(`Position: ${gps.lat}, ${gps.lon}`);
    console.log(`Heading: ${compass.heading}°`);
};
```

## Remember

1. **Always calibrate compass** before first use
2. **Set magnetic declination** for accurate heading
3. **Wait for good fix** (HDOP < 2, sats ≥ 8)
4. **Save GPS config** after setup: `module.save_gps_config()`
5. **Check diagnostics** if accuracy is poor

---

For complete documentation, see [M10_25Q_COMPLETE_GUIDE.md](M10_25Q_COMPLETE_GUIDE.md)
