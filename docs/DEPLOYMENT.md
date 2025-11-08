# AetherLink Deployment Guide

This guide covers deploying the AetherLink SATCOM Control System for production use.

## 🚀 Quick Deployment Checklist

- [ ] Hardware connected and configured
- [ ] Python virtual environment created
- [ ] Backend dependencies installed
- [ ] Frontend built for production
- [ ] Environment variables configured
- [ ] Database initialized
- [ ] Firewall rules configured
- [ ] Service autostart configured
- [ ] System tested and verified

---

## 📋 Prerequisites

### Hardware Requirements

- **Raspberry Pi 4B** (4GB+ RAM) or **NVIDIA Jetson AGX Orin**
- **GPS Module**: GlobalSat BU-353N USB GPS (or compatible)
- **IMU Module**: WitMotion WT901C-TTL 9-axis sensor
- **Servo Motors**: MKS Servo57D (3x) via RS485
- **Limit Switches**: Normally-open limit switches for safety
- **Network**: Ethernet or WiFi connection

### Software Requirements

- **OS**: Ubuntu 20.04+ or Raspberry Pi OS (64-bit)
- **Python**: 3.11 or higher
- **Node.js**: 18+ (for building frontend)
- **Git**: For version control
- **System packages**: See Installation section

---

## 🔧 Installation

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install system dependencies
sudo apt install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    nodejs \
    npm \
    git \
    jq \
    ufw \
    lsof

# Add user to dialout group (for serial ports)
sudo usermod -a -G dialout $USER
# Log out and back in for group change to take effect
```

### 2. Clone or Extract Repository

```bash
# If from git
git clone https://github.com/your-org/aetherlink.git
cd aetherlink

# Or if from archive
cd /home/major/aetherlink
```

### 3. Create Python Virtual Environment

```bash
python3.11 -m venv venv
source venv/bin/activate
```

### 4. Install Backend Dependencies

```bash
pip install --upgrade pip
pip install -r webapp/backend/requirements.txt
```

### 5. Install Frontend Dependencies

```bash
cd webapp/frontend
npm install
cd ../..
```

### 6. Build Frontend for Production

```bash
cd webapp/frontend
npm run build
cd ../..
```

This creates optimized static files in `webapp/frontend/dist/` that the backend will serve.

---

## ⚙️ Configuration

### 1. Hardware Configuration

Edit `tools/config/ports.json`:

```json
{
  "gps": {
    "device": "/dev/gps",
    "baud": 4800,
    "description": "GlobalSat BU-353N USB GPS Module"
  },
  "imu": {
    "device": "/dev/imu",
    "baud": 9600,
    "description": "WitMotion WT901C IMU"
  },
  "rs485": {
    "device": "/dev/rs485",
    "baud": 38400,
    "description": "MKS Servo57D RS485 Bus"
  }
}
```

### 2. Environment Variables (Optional)

Create `.env` file from template:

```bash
cp .env.example .env
nano .env
```

Key settings to customize:
- `HOST=0.0.0.0` (network accessible)
- `PORT=9000` (backend port)
- `DEMO_MODE=False` (use real hardware)
- `LOG_LEVEL=INFO` (production logging)
- Safety limits (AZ_MIN, AZ_MAX, etc.)

### 3. Verify Hardware Detection

```bash
# List all serial ports
ls -l /dev/tty* | grep -E "USB|AMA"

# Verify udev symlinks
ls -l /dev/gps /dev/imu /dev/rs485
```

If symlinks are missing, check your udev rules in `/etc/udev/rules.d/`.

---

## 🔒 Security Configuration

### 1. Firewall Setup

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow ssh

# Allow backend API
sudo ufw allow 9000/tcp

# Allow frontend (if running dev server)
sudo ufw allow 3001/tcp

# Check status
sudo ufw status
```

### 2. Change Default Secrets

Edit `.env` or `webapp/backend/core/config.py`:

```bash
# Generate a strong secret key
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Use the output as your `SECRET_KEY`.

### 3. CORS Configuration

Update `ALLOWED_ORIGINS` in `.env` or `config.py` to match your deployment IPs:

```python
ALLOWED_ORIGINS = [
    "http://192.168.1.100:9000",  # Your Pi's IP
    "http://192.168.1.100:3000",
]
```

---

## 🚦 Running the System

### Option 1: Manual Start (Recommended for Testing)

```bash
# Start everything
./scripts/start-webapp.sh
```

This will:
- Check for port conflicts
- Verify hardware configuration
- Start backend on port 9000
- Start frontend on port 3001 (dev mode)
- Display access URLs

### Option 2: Production Mode (Backend Only)

The backend serves the built frontend automatically:

```bash
./scripts/start-backend.sh
```

Access at: `http://<YOUR_PI_IP>:9000`

### Option 3: Systemd Service (Autostart)

Create a systemd service for automatic startup:

```bash
sudo nano /etc/systemd/system/aetherlink.service
```

Service file:

```ini
[Unit]
Description=AetherLink SATCOM Control System
After=network.target

[Service]
Type=simple
User=major
Group=major
WorkingDirectory=/home/major/aetherlink
Environment="PYTHONPATH=/home/major/aetherlink"
ExecStart=/home/major/aetherlink/venv/bin/hypercorn webapp/backend/main:app --bind 0.0.0.0:9000
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=aetherlink

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable aetherlink
sudo systemctl start aetherlink

# Check status
sudo systemctl status aetherlink

# View logs
sudo journalctl -u aetherlink -f
```

---

## 📡 Accessing the System

### Local Access

```
http://localhost:9000
http://localhost:9000/docs  (Swagger API)
```

### Network Access

Find your Pi's IP:
```bash
hostname -I
```

Access from other devices:
```
http://192.168.1.100:9000
http://192.168.1.100:9000/docs
```

---

## 🧪 Testing & Verification

### 1. Hardware Check

```bash
# Check GPS
python -m tools.diagnostics.gps_test

# Check IMU
python -m tools.diagnostics.imu_test

# Check servos
python -m tools.diagnostics.servo_test
```

### 2. API Health Check

```bash
curl http://localhost:9000/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "services": {
    "telemetry": true,
    "websocket": 0
  }
}
```

### 3. WebSocket Test

Open browser console at `http://<IP>:9000` and run:

```javascript
const ws = new WebSocket('ws://localhost:9000/ws/telemetry');
ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

---

## 🔍 Monitoring & Logs

### View Backend Logs

```bash
# If using systemd
sudo journalctl -u aetherlink -f

# If using start scripts
tail -f backend.log
```

### View Frontend Logs (Dev Mode)

```bash
tail -f frontend.log
```

### Database Location

```
./aetherlink.db
```

View with:
```bash
sqlite3 aetherlink.db
.tables
.schema
```

---

## 🛑 Stopping the System

### Stop Manual Processes

```bash
./scripts/stop-webapp.sh
```

Or kill by PID:
```bash
kill $(cat .webapp_backend.pid)
kill $(cat .webapp_frontend.pid)
```

### Stop Systemd Service

```bash
sudo systemctl stop aetherlink
```

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using port 9000
sudo lsof -i :9000

# Kill it
sudo kill -9 <PID>
```

### Hardware Not Detected

```bash
# Check serial permissions
ls -l /dev/ttyUSB*
ls -l /dev/gps /dev/imu /dev/rs485

# Verify group membership
groups
# Should include 'dialout'
```

### Frontend Not Loading

```bash
# Check if frontend is built
ls -la webapp/frontend/dist/

# Rebuild if needed
cd webapp/frontend && npm run build
```

### Database Errors

```bash
# Remove and recreate database
rm -f aetherlink.db
# Restart backend (will auto-create)
./scripts/start-backend.sh
```

---

## 📊 Performance Tuning

### Backend Optimization

Edit `webapp/backend/main.py` or use environment variables:

```python
# Reduce telemetry rate for lower CPU usage
TELEMETRY_RATE_HZ = 5.0  # Default is 10.0
```

### Resource Limits (Systemd)

Add to service file:

```ini
[Service]
CPUQuota=80%
MemoryLimit=2G
```

---

## 🔄 Updates & Maintenance

### Updating the System

```bash
# Pull latest code (if using git)
git pull

# Update Python dependencies
source venv/bin/activate
pip install --upgrade -r webapp/backend/requirements.txt

# Update frontend dependencies
cd webapp/frontend
npm install
npm run build
cd ../..

# Restart services
sudo systemctl restart aetherlink
```

### Backup

```bash
# Backup database
cp aetherlink.db aetherlink.db.backup

# Backup configuration
tar -czf aetherlink-config-$(date +%Y%m%d).tar.gz \
    tools/config/ \
    .env
```

---

## 📚 Additional Resources

- **API Documentation**: http://localhost:9000/docs
- **Hardware Guides**: [docs/](docs/)
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **Swagger Access**: [docs/SWAGGER_ACCESS.md](docs/SWAGGER_ACCESS.md)

---

## 🆘 Getting Help

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check `docs/` directory
- **Logs**: Always check logs first for error messages

---

**Built with ❤️ for the satellite communication community**
