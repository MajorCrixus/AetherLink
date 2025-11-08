# AetherLink Webapp Startup Guide

## Quick Start

### Start Everything
```bash
cd /home/major/Desktop/aetherlink
./start-webapp.sh
```

### Stop Everything
```bash
cd /home/major/Desktop/aetherlink
./stop-webapp.sh
```

---

## What Gets Started

The `start-webapp.sh` script starts both:

1. **Backend** (FastAPI + Hypercorn)
   - Port: **9000**
   - Bound to: `0.0.0.0` (accessible from network)
   - Includes: Hardware manager, telemetry, servo control, GPS, IMU

2. **Frontend** (React + Vite)
   - Port: **3001**
   - Bound to: `0.0.0.0` (accessible from network)
   - Proxies API calls to backend on port 9000

---

## Access URLs

### From Raspberry Pi (Local)
```
Frontend:    http://localhost:3001
Backend API: http://localhost:9000/docs
```

### From Any Computer on Your Network
```
Frontend:    http://192.168.68.135:3001
Backend API: http://192.168.68.135:9000/docs
```
*(Replace IP with your RPi's actual IP address)*

---

## Features of start-webapp.sh

### ✓ Automatic Checks
- Verifies project directory
- Checks Python virtual environment
- Checks Node.js dependencies
- Detects network IP address
- Validates hardware configuration

### ✓ Port Conflict Resolution
- Detects if ports 9000 or 3001 are already in use
- Shows which process is using the port
- Offers to kill conflicting processes
- Will not crash if ports are busy

### ✓ Firewall Configuration
- Detects if UFW firewall is active
- Checks if ports are allowed
- Offers to automatically configure firewall
- Provides manual commands if needed

### ✓ Background Execution
- Runs both services in background
- Saves process IDs for easy stopping
- Creates log files: `backend.log` and `frontend.log`
- Terminal can be closed safely after startup

### ✓ Graceful Error Handling
- Validates all prerequisites before starting
- Provides clear error messages
- Cleans up on failure
- Suggests solutions for common issues

---

## Script Output Example

```
╔══════════════════════════════════════════════════════════════════╗
║          AetherLink SATCOM Webapp Startup Manager               ║
╚══════════════════════════════════════════════════════════════════╝

▶ Pre-flight Checks
  ✓ Project directory: /home/major/Desktop/aetherlink
  ✓ Python virtual environment found
  ✓ Frontend dependencies found
  ✓ Network IP: 192.168.68.135

▶ Checking Backend Port (9000)
  ✓ Port 9000 is available

▶ Checking Frontend Port (3001)
  ✓ Port 3001 is available

▶ Firewall Configuration
  ℹ Checking firewall for port 9000...
  ✓ Port 9000 is allowed in firewall
  ℹ Checking firewall for port 3001...
  ✓ Port 3001 is allowed in firewall

▶ Hardware Configuration
  ℹ IMU:   /dev/ttyUSB1
  ℹ RS485: /dev/ttyUSB0
  ✓ RS485 device found

▶ Starting Backend (Hypercorn on port 9000)
  ℹ Starting backend server...
  ✓ Backend started (PID: 12345)
  ℹ Backend logs: /home/major/Desktop/aetherlink/backend.log
  ✓ Backend responding on http://localhost:9000

▶ Starting Frontend (Vite on port 3001)
  ℹ Starting frontend development server...
  ✓ Frontend started (PID: 12346)
  ℹ Frontend logs: /home/major/Desktop/aetherlink/frontend.log
  ✓ Frontend responding on http://localhost:3001

▶ Startup Complete!

╔══════════════════════════════════════════════════════════════════╗
║                    Access Your Webapp                            ║
╚══════════════════════════════════════════════════════════════════╝

From this computer:
  Frontend:    http://localhost:3001
  Backend:     http://localhost:9000
  Swagger API: http://localhost:9000/docs

From other computers on your network:
  Frontend:    http://192.168.68.135:3001
  Backend:     http://192.168.68.135:9000
  Swagger API: http://192.168.68.135:9000/docs

Process IDs:
  Backend PID:  12345
  Frontend PID: 12346

Logs:
  Backend:  tail -f /home/major/Desktop/aetherlink/backend.log
  Frontend: tail -f /home/major/Desktop/aetherlink/frontend.log

To stop:
  Kill backend:  kill 12345
  Kill frontend: kill 12346
  Or use:        ./stop-webapp.sh
```

---

## Monitoring Logs

### View Backend Logs
```bash
# Follow live logs
tail -f backend.log

# View last 50 lines
tail -n 50 backend.log

# Search for errors
grep ERROR backend.log
```

### View Frontend Logs
```bash
# Follow live logs
tail -f frontend.log

# View last 50 lines
tail -n 50 frontend.log
```

---

## Troubleshooting

### Port Already in Use

**Symptom**: Script detects port conflict

**Solution**: Script will ask if you want to kill the existing process. Choose:
- `y` - Kill the process and continue
- `n` - Exit and handle manually

Manual cleanup:
```bash
# Kill specific port
sudo lsof -ti:9000 | xargs kill -9
sudo lsof -ti:3001 | xargs kill -9

# Or use stop script
./stop-webapp.sh
```

### Firewall Blocking Access

**Symptom**: Can't access from remote computer

**Solution**: The script will detect and offer to configure firewall. Or manually:
```bash
# Check firewall status
sudo ufw status

# Allow ports
sudo ufw allow 9000/tcp
sudo ufw allow 3001/tcp

# Reload firewall
sudo ufw reload
```

### Backend Fails to Start

**Symptom**: Backend PID shows but not responding

**Check logs**:
```bash
tail -f backend.log
```

**Common causes**:
- Hardware devices not connected (IMU, RS485, GPS)
- Python dependencies missing
- Database issues

**Solution**: Backend will continue running even if hardware fails. Check logs for specifics.

### Frontend Fails to Start

**Symptom**: Frontend PID shows but not responding

**Check logs**:
```bash
tail -f frontend.log
```

**Common causes**:
- Node modules not installed
- Vite compilation errors
- Port conflict

**Solution**:
```bash
# Reinstall dependencies
cd webapp/frontend
npm install
cd ../..

# Try again
./start-webapp.sh
```

### Can't Access from Remote Computer

**Check network connectivity**:
```bash
# From remote computer
ping 192.168.68.135

# Check if ports are open
curl http://192.168.68.135:9000/docs
curl http://192.168.68.135:3001
```

**Verify IP address**:
```bash
# On RPi
hostname -I
```

**Check firewall** (see Firewall Blocking section above)

---

## Advanced Usage

### Custom Ports

Edit the script to change ports:
```bash
nano start-webapp.sh

# Modify these lines:
BACKEND_PORT=9000
FRONTEND_PORT=3001
```

Also update `webapp/frontend/vite.config.ts`:
```typescript
server: {
  port: 3001,  // Change this
}
```

### Production Deployment

For production, build the frontend and serve static files:
```bash
# Build frontend
cd webapp/frontend
npm run build

# Serve from backend
# (Already configured in backend to serve from dist/)
```

### Systemd Service (Auto-start on Boot)

To make the webapp start automatically on boot, create a systemd service:

```bash
# Create service file
sudo nano /etc/systemd/system/aetherlink-webapp.service
```

```ini
[Unit]
Description=AetherLink SATCOM Webapp
After=network.target

[Service]
Type=forking
User=major
WorkingDirectory=/home/major/Desktop/aetherlink
ExecStart=/home/major/Desktop/aetherlink/start-webapp.sh
ExecStop=/home/major/Desktop/aetherlink/stop-webapp.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable aetherlink-webapp
sudo systemctl start aetherlink-webapp

# Check status
sudo systemctl status aetherlink-webapp
```

---

## Stopping the Webapp

### Using the Stop Script (Recommended)
```bash
./stop-webapp.sh
```

This will:
- Gracefully stop both backend and frontend
- Try SIGTERM first, then SIGKILL if needed
- Clean up saved PID files
- Verify ports are released

### Manual Stop
```bash
# Kill by PID (shown at startup)
kill 12345  # backend
kill 12346  # frontend

# Or kill all instances
pkill -f hypercorn
pkill -f vite
```

### Check Status
```bash
# Check if processes are running
ps aux | grep hypercorn
ps aux | grep vite

# Check if ports are in use
lsof -i :9000
lsof -i :3001
```

---

## Files Created by Scripts

- **`.webapp_backend.pid`** - Backend process ID (auto-created)
- **`.webapp_frontend.pid`** - Frontend process ID (auto-created)
- **`backend.log`** - Backend output log
- **`frontend.log`** - Frontend output log

These files are in the project root (`/home/major/Desktop/aetherlink/`)

---

## Comparison with Old Scripts

| Feature | `start-backend.sh` | `start-webapp.sh` |
|---------|-------------------|-------------------|
| Starts backend | ✓ | ✓ |
| Starts frontend | ✗ | ✓ |
| Port conflict handling | Basic | Advanced |
| Firewall config | ✗ | ✓ |
| Background execution | ✗ (foreground) | ✓ |
| Log files | ✗ (stdout) | ✓ |
| Saved PIDs | ✗ | ✓ |
| Stop script | ✗ | ✓ |
| Network accessibility | ✓ | ✓ |
| Pretty output | ✓ | ✓✓ |

**Recommendation**: Use `start-webapp.sh` for full-stack deployment. Keep individual scripts for testing backend/frontend separately.

---

## Security Notes

### Network Exposure

Both services are bound to `0.0.0.0`, meaning they accept connections from any IP address on your network.

**Production recommendations**:
1. **Use a reverse proxy** (nginx) with HTTPS
2. **Add authentication** (not currently implemented)
3. **Restrict firewall** to specific IPs if needed
4. **Use VPN** for remote access instead of exposing ports

### Current Security Status

⚠️ **No authentication** - Anyone on your network can access
⚠️ **HTTP only** - Traffic is unencrypted
✓ **Firewall required** - Script helps configure UFW
✓ **Local network only** - Not exposed to internet (unless port forwarded)

---

## Tips & Best Practices

1. **Always check logs** if something doesn't work
2. **Use stop script** before restarting to avoid conflicts
3. **Monitor hardware** - Backend will run even if servos fail
4. **Test locally first** before accessing remotely
5. **Keep dependencies updated** - `pip install -U` and `npm update`
6. **Backup your data** - Especially the database and config files

---

## Quick Command Reference

```bash
# Start webapp
./start-webapp.sh

# Stop webapp
./stop-webapp.sh

# View backend logs
tail -f backend.log

# View frontend logs
tail -f frontend.log

# Check what's running
ps aux | grep -E "hypercorn|vite"

# Check ports
lsof -i :9000
lsof -i :3001

# Get IP address
hostname -I

# Test from remote
curl http://192.168.68.135:9000/docs
```

---

## Support

If you encounter issues:

1. Check the logs (`backend.log` and `frontend.log`)
2. Verify firewall settings (`sudo ufw status`)
3. Test connectivity (`ping`, `curl`)
4. Try stopping and restarting
5. Check hardware connections (IMU, RS485, GPS)

For hardware-specific issues, see:
- [RS485_TEST_GUIDE.md](back_end/tools/diagnostics/RS485_TEST_GUIDE.md)
- [SWAGGER_ACCESS.md](back_end/hardware/motors/SWAGGER_ACCESS.md)
