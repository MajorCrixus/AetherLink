# AetherLink Troubleshooting Guide

## Quick Diagnostics

### Test IMU Directly
```bash
# Stop backend first!
pkill -f "uvicorn backend.main"

# Test IMU live data stream
python3 /home/major/Desktop/aetherlink/imu-test-live.py
```

Expected output:
```
[  42] Roll:    0.13°  Pitch:    0.92°  Yaw: -159.76°  Temp: 181.3°C
```

### Check Hardware Ports
```bash
# List all serial devices
python3 -m back_end.tools.diagnostics.list_serial

# Current port configuration
cat webapp/config/ports.json
```

### Web App Not Showing IMU Data

**Issue**: IMU shows all zeros in web app

**Root Cause**: The `latest_imu_angles` variable stays None even though IMU connects successfully. This happens because:

1. **Rate change command disrupts stream**: Calling `imu.set_output_rate_hz(50)` right after connection may reset/pause the IMU data stream
2. **Timing issue**: The 1-second initialization test sees data, but then stream stops

**Quick Fix**:
1. Kill backend: `pkill -f uvicorn`
2. Test IMU standalone: `python3 imu-test-live.py`
3. If IMU works standalone, the issue is in the backend integration

**The commented-out fix** (already applied in hardware_manager.py line 172-176):
```python
# Don't change IMU rate immediately after connection
# self.imu.set_output_rate_hz(50)  # This may disrupt the stream!
```

### Backend Logs

```bash
# Watch live backend logs
journalctl -u aetherlink -f

# Or if running manually
# Logs appear in terminal where you ran ./start-backend.sh
```

### WebSocket Connection Issues

If browser shows repeated connect/disconnect:
1. Check backend is running: `curl http://localhost:9000/health`
2. Check for errors in browser console (F12)
3. Verify CORS settings allow localhost:3000

### Port Conflicts

```bash
# Check what's using port 9000
lsof -i :9000

# Check what's using serial ports
lsof /dev/ttyUSB0 /dev/ttyUSB1 /dev/ttyAMA0
```

### IMU Initialization Failed

If you see: `ERROR - Failed to initialize IMU at any baud rate`

**Causes**:
1. Wrong port - Check `webapp/config/ports.json`
2. Another process using the port
3. IMU not powered/connected
4. Wrong baud rate

**Fix**:
```bash
# Verify IMU hardware
ls -la /dev/ttyUSB*

# Test directly
python3 imu-test-live.py
```

### Servo Errors: "Bad uplink header: 787878"

**Cause**: Backend is reading from wrong port - getting IMU data (0x78) instead of servo responses

**Fix**: Update `webapp/config/ports.json` with correct port mappings:
```json
{
  "imu": {"device": "/dev/ttyUSB1", ...},
  "rs485": {"device": "/dev/ttyUSB0", ...}
}
```

Then restart backend.

### GPS Thread Crash

If you see: `SerialException: device reports readiness to read but returned no data`

**Cause**: GPS port conflict or hardware issue

**Fix**:
1. Check no other process using `/dev/ttyAMA0`
2. Restart backend
3. If persistent, check GPS hardware connection

## File Locations

- **Backend config**: `webapp/backend/core/config.py`
- **Port mappings**: `webapp/config/ports.json` (runtime) and `back_end/tools/config/ports.json` (source)
- **Startup scripts**: `start-backend.sh`, `start-frontend.sh`
- **Hardware drivers**: `back_end/hardware/`

## Common Commands

```bash
# Start everything
./start-backend.sh     # Terminal 1
./start-frontend.sh    # Terminal 2

# Stop everything
pkill -f uvicorn       # Stop backend
pkill -f "npm.*dev"    # Stop frontend

# Test individual hardware
python3 -m back_end.tools.diagnostics.imu_test
python3 -m back_end.tools.diagnostics.gps_uart_test
python3 -m back_end.tools.diagnostics.servo_probe

# Update port mappings after USB device changes
python3 -m back_end.tools.diagnostics.list_serial
# Manually edit webapp/config/ports.json
```

## Understanding the IMU Issue

The web app IMU problem boils down to this code in `hardware_manager.py`:

```python
def _get_imu_telemetry(self, timestamp: str) -> IMU:
    if not self.imu or not self.latest_imu_angles:  # ← Returns zeros if None!
        return IMU(roll_deg=0.0, pitch_deg=0.0, yaw_deg=0.0, ts=timestamp)
```

Even though `self.imu` is initialized successfully, `self.latest_imu_angles` remains None, causing zeros to be returned.

**Why it stays None**:
- During init, IMU sends data → `latest_imu_angles` gets set → "connected successfully"
- Then `set_output_rate_hz(50)` is called → IMU pauses/resets
- Callback never fires again → `latest_imu_angles` stays at initial value or gets cleared
- Telemetry always returns zeros

**Solution**: Don't reconfigure IMU right after connection, or add a delay/retry after configuration.

---
Last Updated: 2025-10-09
