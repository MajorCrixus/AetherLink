# SDR Module Setup Guide

Complete HackRF One integration for signal monitoring and antenna alignment.

## Prerequisites

### 1. Install HackRF Tools

```bash
sudo apt update
sudo apt install hackrf libhackrf-dev
```

### 2. Verify HackRF Detection

```bash
hackrf_info
```

Expected output:
```
Found HackRF
Serial number: 0x000000000000000054706b85252d3233
Board ID Number: 2 (HackRF One)
Firmware Version: 2018.01.1 (API:1.02)
```

### 3. Test Signal Sweep

```bash
# Quick sweep from 100-200 MHz
hackrf_sweep -f 100:200 -n 8192
```

## Backend Implementation

### Created Files

1. **`/webapp/backend/services/sdr_manager.py`** - HackRF device manager
   - Device detection via `hackrf_info`
   - Signal monitoring via `hackrf_sweep`
   - Real-time signal strength measurements

2. **`/webapp/backend/api/endpoints/sdr.py`** - REST API & WebSocket
   - `GET /api/sdr/device` - Device info
   - `POST /api/sdr/start` - Start monitoring
   - `POST /api/sdr/stop` - Stop monitoring
   - `GET /api/sdr/signal` - Get signal strength
   - `GET /api/sdr/status` - Monitoring status
   - `WS /api/sdr/ws` - Real-time signal streaming

3. **`/webapp/frontend/src/hooks/useSDRWebSocket.ts`** - WebSocket hook
   - Auto-reconnecting WebSocket connection
   - Real-time signal data streaming

## Frontend Features

Access at: **http://localhost:3001/modules/sdr**

### Device Management
- Real-time HackRF connection status
- Serial number, firmware version, board ID display
- Device detection with helpful error messages

### Beacon Presets
Pre-configured satellites:
- **NOAA 15/18/19** - 137 MHz APT weather satellites
- **ISS** - 145.8 MHz FM voice repeater
- **Starlink** - 10.7 GHz Ku-band example

### Signal Monitoring
- Real-time signal strength (dBm)
- Peak signal tracking with reset
- Signal history chart (last 30 seconds)
- Color-coded signal strength bar

### Device Settings
- **LNA Gain**: 0-40 dB (8 dB steps)
- **VGA Gain**: 0-62 dB (2 dB steps)
- **RF Amplifier**: +14 dB boost (use carefully!)

### Antenna Alignment Workflow
1. Select beacon from preset list
2. Start monitoring
3. Manually adjust Az/El/CL servos
4. Watch signal strength meter
5. Fine-tune to maximize peak signal
6. (Future) Use Auto-Tune for automated alignment

## API Usage Examples

### Check Device
```bash
curl http://192.168.68.135:9000/api/sdr/device
```

### Start Monitoring
```bash
curl -X POST http://192.168.68.135:9000/api/sdr/start \
  -H "Content-Type: application/json" \
  -d '{
    "frequency": 137.62,
    "gain_lna": 16,
    "gain_vga": 20,
    "amp_enabled": false,
    "bandwidth": 0.04
  }'
```

### Get Signal Strength
```bash
curl http://192.168.68.135:9000/api/sdr/signal
```

### Stop Monitoring
```bash
curl -X POST http://192.168.68.135:9000/api/sdr/stop
```

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://192.168.68.135:9000/api/sdr/ws')

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(`Signal: ${data.power_dbm} dBm at ${data.frequency_mhz} MHz`)
}
```

## Testing

### 1. Start Backend
```bash
cd /home/major/aetherlink
./start-webapp.sh
```

### 2. Connect HackRF
```bash
# Verify detection
hackrf_info

# Check permissions if needed
sudo usermod -a -G plugdev $USER
```

### 3. Test API Manually
```bash
# Check device
curl http://192.168.68.135:9000/api/sdr/device

# Start monitoring NOAA 15
curl -X POST http://192.168.68.135:9000/api/sdr/start \
  -H "Content-Type: application/json" \
  -d '{"frequency": 137.62, "gain_lna": 16, "gain_vga": 20, "amp_enabled": false, "bandwidth": 0.04}'

# Get signal (run multiple times to see changes)
watch -n 1 curl -s http://192.168.68.135:9000/api/sdr/signal

# Stop
curl -X POST http://192.168.68.135:9000/api/sdr/stop
```

### 4. Use Web Interface
1. Open http://192.168.68.135:3001/modules/sdr
2. Click "Refresh" to detect HackRF
3. Select a beacon from the list
4. Click "Start Monitoring"
5. Observe real-time signal strength updates

## Troubleshooting

### HackRF Not Detected
```bash
# Check USB connection
lsusb | grep HackRF

# Check permissions
ls -l /dev/bus/usb/*/

# Add user to plugdev group
sudo usermod -a -G plugdev $USER
# Log out and back in

# Try with sudo (temporary test)
sudo hackrf_info
```

### Permission Denied
```bash
# Create udev rule
sudo nano /etc/udev/rules.d/52-hackrf.rules

# Add this line:
ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", SYMLINK+="hackrf-one-%k", MODE="0666", GROUP="plugdev"

# Reload udev
sudo udevadm control --reload-rules
sudo udevadm trigger

# Reconnect HackRF
```

### Backend Not Starting
```bash
# Check if port 9000 is available
lsof -i:9000

# Check backend logs
tail -f /home/major/aetherlink/backend.log

# Check Python dependencies
cd /home/major/aetherlink
source venv/bin/activate
pip list | grep -i fastapi
```

### WebSocket Not Connecting
```bash
# Check WebSocket endpoint
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://192.168.68.135:9000/api/sdr/ws
```

## Future Enhancements

### Phase 2
- [ ] FFT spectrum waterfall display
- [ ] Configurable sweep parameters
- [ ] Multiple beacon monitoring
- [ ] Signal recording/playback

### Phase 3
- [ ] Auto-tuning algorithm (hill climbing)
- [ ] Integration with servo control API
- [ ] Automated satellite tracking
- [ ] Peak-finding for alignment

### Phase 4
- [ ] GNU Radio integration
- [ ] Demodulation support
- [ ] IQ data capture
- [ ] Advanced signal analysis

## Technical Details

### Signal Processing Flow
1. User selects beacon frequency
2. Frontend sends start request to backend
3. Backend starts `hackrf_sweep` subprocess
4. Backend parses sweep output for target frequency
5. Backend extracts power (dBm) at beacon frequency
6. Backend streams data via WebSocket
7. Frontend displays real-time signal strength

### HackRF Sweep Command
```bash
hackrf_sweep -f start_mhz:end_mhz -l lna_gain -g vga_gain [-a] -n samples
```

Example for NOAA 15:
```bash
hackrf_sweep -f 137.60:137.64 -l 16 -g 20 -n 8192
```

### Frequency Ranges
- **VHF**: 30-300 MHz (weather satellites, ISS)
- **UHF**: 300-1000 MHz (amateur radio, satellites)
- **L-band**: 1-2 GHz (GPS, Inmarsat)
- **S-band**: 2-4 GHz (radar, satellites)
- **X-band**: 8-12 GHz (military satellites)
- **Ku-band**: 12-18 GHz (Starlink, satellite TV)

### Signal Strength Guidelines
- **-60 dBm**: Very strong signal
- **-80 dBm**: Good signal (typical for LEO satellites)
- **-100 dBm**: Weak signal (requires good antenna alignment)
- **-120 dBm**: Very weak (near noise floor)

## Resources

- [HackRF Documentation](https://hackrf.readthedocs.io/)
- [hackrf_sweep Man Page](https://manpages.ubuntu.com/manpages/jammy/man1/hackrf_sweep.1.html)
- [NOAA APT Frequencies](https://www.sigidwiki.com/wiki/Automatic_Picture_Transmission_(APT))
- [Satellite Frequency Database](https://www.satbeams.com/)
