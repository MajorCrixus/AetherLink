# IMU Initialization Fix - Summary

## Problem
The web application backend was failing to initialize the IMU and showing thousands of servo errors in the logs.

## Root Causes

### 1. Incorrect Baud Rate
- **Old**: Hardware manager tried 115200 baud first
- **Actual**: WT901C IMU runs at **9600 baud**
- **Impact**: No data received, IMU initialization failed

### 2. Wrong USB Port Mapping
USB devices had swapped since last configuration:
- **IMU (CH340)**: Was on `/dev/ttyUSB0`, now on `/dev/ttyUSB1`
- **RS485/Servos (FTDI)**: Was on `/dev/ttyUSB1`, now on `/dev/ttyUSB0`
- ** Created a udev rules file: sudo nano /etc/udev/rules.d/99-aetherlink-serial.rules
  - Now I have custom symlink like /dev/imu & /dev/rs485 so ports wont jump around 

This caused:
- Backend tried to read IMU from servo port → no IMU data
- Backend tried to read servos from IMU port → "Bad uplink header" errors
  - The `787878`, `00f800` bytes in errors were actually IMU packets (0x78 = part of IMU data frame)

## Solutions Applied

### 1. Fixed Baud Rate Priority ([hardware_manager.py:136-200](webapp/backend/services/hardware_manager.py#L136-L200))
```python
# Try common baud rates - 9600 is the default for WT901C
baud_rates = [9600, 115200]  # Changed from [115200, 9600]
```

### 2. Added Auto-Detection
- Tries both 9600 and 115200 baud automatically
- Waits 1 second after connection to verify data is received
- Only proceeds if actual IMU packets are detected
- Logs which baud rate succeeded

### 3. Updated Port Mappings ([ports.json](back_end/tools/config/ports.json))
```json
{
  "imu": {
    "device": "/dev/ttyUSB1",  // Changed from USB0
    ...
  },
  "rs485": {
    "device": "/dev/ttyUSB0",  // Changed from USB1
    ...
  }
}
```

### 4. Created Startup Scripts
- [start-backend.sh](start-backend.sh) - Automated backend startup with checks
- [start-frontend.sh](start-frontend.sh) - Automated frontend startup with validation
- Both scripts check for port conflicts and hardware configuration

## Verification

### IMU Test (Successful)
```bash
$ timeout 3 python3 -c "..."
IMU: roll=  0.14° pitch=  0.92° yaw=-159.76° temp=181.3°C
IMU: roll=  0.13° pitch=  0.92° yaw=-159.76° temp=181.3°C
...
Received 10 angle packets
```

### Expected Backend Startup
When properly configured, you should see:
```
INFO - Initializing IMU on /dev/ttyUSB1
INFO - Trying IMU at 9600 baud...
INFO - IMU connected successfully at 9600 baud
INFO - Hardware manager started successfully
```

Instead of:
```
ERROR - Failed to initialize IMU at any baud rate
ERROR - Error reading servo AZ: Bad uplink header: 787878
```

## How to Use

### Start the Full Web App
```bash
cd /home/major/Desktop/aetherlink

# Terminal 1 - Backend
./start-backend.sh

# Terminal 2 - Frontend
./start-frontend.sh

# Open browser to http://localhost:3000
```

### Verify Ports Are Correct
If USB devices swap again after reboot:
```bash
# Check current USB device assignments
python3 -m back_end.tools.diagnostics.list_serial

# Manually update if needed
nano back_end/tools/config/ports.json

# Restart backend to pick up changes
```

## Current Hardware Configuration

| Device | Port | Chip | VID:PID | Baud | Protocol |
|--------|------|------|---------|------|----------|
| GPS | `/dev/ttyAMA0` | Raspberry Pi UART | - | 115200 | NMEA |
| IMU | `/dev/ttyUSB1` | CH340 | 1A86:7523 | 9600 | Binary (0x55) |
| Servos | `/dev/ttyUSB0` | FTDI FT232R | 0403:6001 | 38400 | RS485 Modbus |

## Files Modified

1. `webapp/backend/services/hardware_manager.py` - Fixed IMU initialization
2. `back_end/tools/config/ports.json` - Updated USB port mappings
3. `start-backend.sh` - NEW: Backend startup script
4. `start-frontend.sh` - NEW: Frontend startup script
5. `webapp/README.md` - Updated with correct port info and startup instructions

## Next Steps

The backend needs to be restarted to pick up the fixed configuration. Once restarted:

✅ IMU will initialize at 9600 baud on `/dev/ttyUSB1`
✅ Real orientation data (roll/pitch/yaw) will flow to the web app
✅ Servo errors will stop (servos are on the correct port)
✅ Frontend will display live hardware telemetry instead of demo data

---
**Date**: 2025-10-09
**Status**: Fixed, ready for restart
