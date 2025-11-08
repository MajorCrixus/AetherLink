# Swagger UI Access Guide

## Two Ways to Access Your Servo APIs

You have two separate FastAPI services with Swagger UI available:

---

## 1. Main AetherLink Backend (High-Level, Production)

**Port**: 9000
**Already running** via `start-backend.sh`

### Access:
```
http://<RPI_IP>:9000/docs
```

### Features:
- **High-level servo control** with safety limits
- **Real-time telemetry** streaming (10Hz)
- **WebSocket** support for live data
- **GPS, IMU, and Servo** integration
- **Demo mode** simulation
- **CLI whitelist** system

### Key Endpoints:
- `POST /api/servos/{axis}/move` - Move with safety checks
- `POST /api/servos/{axis}/stop` - Emergency stop
- `GET /api/telemetry/stream` - Real-time data
- `WS /ws/telemetry` - WebSocket telemetry

**Best for**: Production use, web interface, safety-critical operations

---

## 2. Low-Level Servo API (Direct Hardware, Testing)

**Port**: 8083 (configurable)
**Run manually** when needed

### Start the Service:
```bash
cd /home/major/Desktop/aetherlink
./start-servo-api.sh
```

Or with custom settings:
```bash
SERVO_PORT=/dev/rs485 \
SERVO_BAUD=38400 \
SERVO_ADDR=1 \
SERVO_API_PORT=8083 \
./start-servo-api.sh
```

### Access:
```
http://<RPI_IP>:8083/docs
```

### Features:
- **100% v1.0.6 command coverage** (~50 commands)
- **Direct hardware access** (no safety checks)
- **Real-time polling** (10Hz background thread)
- **SSE and WebSocket** streaming
- **Complete configuration** control

### Key Endpoint Categories:
1. **Motion**: `/motion/speed`, `/motion/rel/deg`, `/motion/abs/deg`, `/estop`
2. **Monitoring**: `/snapshot`, `/sse`, `/ws`, `/io`
3. **Homing**: `/home`, `/zero`, `/single_turn_home`, `/calibrate_zero`
4. **Configuration**: `/config/mode`, `/config/current_ma`, `/config/limits`
5. **Advanced v1.0.6**: `/config/limit_polarity`, `/config/pos_error_threshold`

**Best for**: Low-level testing, debugging, firmware feature exploration

---

## Quick Start Examples

### From Your Remote PC

Replace `192.168.1.100` with your actual RPi IP address:

**Main Backend Swagger**:
```
http://192.168.1.100:9000/docs
```

**Low-Level Servo Swagger**:
```
http://192.168.1.100:8083/docs
```

### Find Your RPi IP Address

On the RPi, run:
```bash
hostname -I
```

Or check your router's DHCP table.

---

## Testing the Connection

### From Remote PC Terminal:
```bash
# Test main backend
curl http://<RPI_IP>:9000/health

# Test servo API (if running)
curl http://<RPI_IP>:8083/health
```

### From Remote PC Browser:
Navigate to the `/docs` URL and you should see the interactive Swagger UI with:
- Expandable endpoint sections
- "Try it out" buttons
- Request/response schemas
- Built-in execution

---

## Firewall Configuration (if needed)

If you can't connect, you may need to open ports on the RPi:

```bash
# Check if firewall is active
sudo ufw status

# If active, allow ports
sudo ufw allow 9000/tcp
sudo ufw allow 8083/tcp
```

---

## Configuration Files

### Main Backend
- Config: `webapp/backend/core/config.py`
- Startup: `start-backend.sh`
- Default host: `0.0.0.0` (accessible from network) ✓
- Default port: `9000`

### Low-Level Servo API
- Library: `back_end/hardware/motors/mks_servo57d_lib.py`
- API: `back_end/hardware/motors/servo57d_api.py`
- Startup: `start-servo-api.sh`
- Default host: `0.0.0.0` (configured in script) ✓
- Default port: `8083`

---

## Swagger UI Features

Once connected, you can:

1. **Browse all endpoints** - Organized by tags/categories
2. **View schemas** - See exact request/response formats
3. **Try it out** - Execute API calls directly from browser
4. **Download OpenAPI spec** - Export as JSON/YAML
5. **Authorize** - If authentication is configured (not yet implemented)

### Example: Moving a Servo via Swagger

1. Open `http://<RPI_IP>:8083/docs`
2. Find `POST /motion/rel/deg`
3. Click "Try it out"
4. Enter JSON body:
   ```json
   {
     "degrees": 45.0,
     "rpm": 50,
     "acc": 10
   }
   ```
5. Click "Execute"
6. See real-time response

---

## Troubleshooting

### Can't connect from remote PC:

1. **Verify RPi IP**: `hostname -I` on RPi
2. **Check service is running**: `curl http://localhost:9000/health` on RPi
3. **Check host binding**: Look for `0.0.0.0` not `127.0.0.1` in logs
4. **Test local first**: Access from RPi browser: `http://localhost:9000/docs`
5. **Check firewall**: `sudo ufw status` and allow ports if needed
6. **Network connectivity**: `ping <RPI_IP>` from remote PC

### Servo API not responding:

1. **Check serial port**: `ls -l /dev/ttyUSB*`
2. **Check permissions**: Add user to dialout: `sudo usermod -a -G dialout $USER`
3. **Check if running**: `ps aux | grep servo57d_api`
4. **View logs**: Check terminal output where you ran `start-servo-api.sh`

---

## Security Note

Both APIs currently have **no authentication**. They are accessible to anyone on your network. For production use, consider:

- Adding API key authentication
- Using HTTPS/TLS
- Restricting CORS origins
- Using a reverse proxy (nginx)
- Network segmentation
