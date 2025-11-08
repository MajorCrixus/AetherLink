# AetherLink SATCOM Control System

A desktop-first, local-only web application for monitoring, configuring, and controlling the AetherLink satellite tracking antenna system. Features an INAV-inspired dark theme with sci-fi mission control aesthetics.

![AetherLink Dashboard](docs/images/dashboard-preview.png)

## 🌟 Features

### Core Functionality
- **Real-time Telemetry** - 10Hz streaming of GPS, IMU, servo, and system data
- **3D Visualization** - Interactive globe with antenna position and satellite tracking
- **INAV-style Interface** - Dark theme with health status indicators and HUD widgets
- **Hardware Integration** - Direct support for u-blox GPS, WitMotion IMU, and MKS servos
- **Safety Systems** - Software limits, emergency stops, and protection mechanisms
- **Demo Mode** - Realistic simulation for testing and development

### Hardware Support
- **GPS**: u-blox M10-25Q via UART (`/dev/ttyAMA0`, 115200 baud, auto-detected)
- **IMU**: WitMotion WT901C-TTL 9-axis sensor (`/dev/ttyUSB1`, 9600 baud, auto-detected)
- **Servos**: MKS Servo57D v1.0.6 via RS485 (`/dev/ttyUSB0`, 38400 baud)
- **Limits**: Normally-open limit switches for azimuth range detection
- **Platform**: Raspberry Pi 4B (Ubuntu 25.04)

> **Note**: The IMU and Servo ports are auto-detected and configured in `back_end/tools/config/ports.json`. USB device order may change on reboot.

### User Interface
- **Dashboard** - 3D globe, real-time HUD widgets, satellite selection
- **Modules** - Individual configuration pages for each hardware component
- **Configuration** - System settings, safety parameters, and operational modes
- **CLI** - Embedded terminal with whitelisted command execution
- **Logs & Events** - Real-time system monitoring and alerts

## 🚀 Quick Start

### Prerequisites
- Raspberry Pi 4B or compatible Linux system
- Docker and Docker Compose
- Node.js 18+ (for development)
- Python 3.11+ (for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/aetherlink.git
   cd aetherlink/webapp
   ```

2. **Run the installer** (Raspberry Pi/Ubuntu)
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

3. **Access the web interface**
   ```
   http://your-pi-ip:9000
   ```

### Development Setup

**Quick Start with Scripts:**
```bash
# Terminal 1 - Start backend
./start-backend.sh

# Terminal 2 - Start frontend
./start-frontend.sh

# Open browser to http://localhost:3000
```

**Manual Setup:**

1. **Backend setup**
   ```bash
   cd webapp
   PYTHONPATH=/home/major/Desktop/aetherlink \
     ../venv/bin/python -m uvicorn backend.main:app \
     --host 0.0.0.0 --port 9000 --log-level info
   ```

2. **Frontend setup**
   ```bash
   cd webapp/frontend
   npm install
   npm run dev
   ```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, TailwindCSS, Three.js, Framer Motion
- **Backend**: FastAPI, WebSockets, SQLite, asyncio
- **Hardware**: PySerial, existing hardware driver modules
- **Deployment**: Docker, systemd, nginx

### System Design
```
┌─────────────────┐    WebSocket    ┌──────────────────┐    Serial/RS485    ┌─────────────┐
│   React Frontend│◄──────────────►│   FastAPI Backend│◄──────────────────►│   Hardware  │
│                 │                 │                  │                     │             │
│ • 3D Globe      │                 │ • Telemetry Bus  │                     │ • GPS       │
│ • HUD Widgets   │                 │ • Safety Systems │                     │ • IMU       │
│ • Health Bar    │                 │ • Demo Simulator │                     │ • Servos    │
│ • Module Config │                 │ • Hardware Mgr   │                     │ • Limits    │
└─────────────────┘                 └──────────────────┘                     └─────────────┘
```

### Key Components

#### Frontend (`frontend/`)
- **Components**: Reusable UI components with INAV styling
- **Pages**: Dashboard, Configuration, Modules, Logs, CLI
- **Stores**: Zustand stores for telemetry and UI state
- **Hooks**: WebSocket management and real-time data

#### Backend (`backend/`)
- **API**: RESTful endpoints for configuration and control
- **Services**: Telemetry collection, WebSocket management, hardware interface
- **Models**: Type-safe data contracts matching frontend
- **Safety**: Guard rails, limits checking, emergency stops

#### Hardware Integration (`back_end/`)
- Existing proven drivers for GPS, IMU, and servo control
- Clean abstractions for easy hardware swapping
- Comprehensive error handling and diagnostics

## 🛠️ Configuration

### Environment Variables
```bash
# Server Configuration
HOST=0.0.0.0
PORT=9000
DEBUG=false

# Hardware Paths (fallback defaults, ports.json takes precedence)
GPS_PORT=/dev/ttyAMA0
IMU_PORT=/dev/ttyUSB1
RS485_PORT=/dev/ttyUSB0

# Safety Limits (degrees)
AZ_MIN=-300
AZ_MAX=300
EL_MIN=-59
EL_MAX=59
CL_MIN=-10
CL_MAX=10

# Demo Mode
DEMO_MODE=true
TELEMETRY_RATE_HZ=10.0
```

### Docker Compose Override
For production deployment with hardware access:
```yaml
# docker-compose.override.yml
version: '3.8'
services:
  aetherlink:
    devices:
      - /dev/ttyAMA0:/dev/ttyAMA0
      - /dev/ttyUSB0:/dev/ttyUSB0
      - /dev/ttyUSB1:/dev/ttyUSB1
    environment:
      - DEMO_MODE=false
```

## 🔧 Hardware Setup

### Raspberry Pi 4B Configuration

1. **Enable UART for GPS**
   ```bash
   # Add to /boot/config.txt
   enable_uart=1
   dtoverlay=disable-bt
   ```

2. **USB Device Mapping**
   ```bash
   # Check device assignments
   ls -la /dev/tty*

   # Typical mapping:
   # /dev/ttyAMA0  - GPS (UART)
   # /dev/ttyUSB0  - IMU (USB-TTL)
   # /dev/ttyUSB1  - RS485 Hub (USB-RS485)
   ```

3. **Servo Configuration**
   - Azimuth: MKS Servo57D addr=1, with limit switches
   - Elevation: MKS Servo57D addr=2, stall detection
   - Cross-level: MKS Servo57D addr=3, stall detection

### Antenna Specifications
- **Azimuth Range**: -600° to +600° (limit switch protected)
- **Elevation Range**: -59° to +59° (software limited)
- **Cross-level Range**: ±10° (fine adjustment)

## 🧪 Demo Mode

The application includes a comprehensive demo mode for testing without hardware:

### Demo Profiles
- **lab**: Stable conditions, minimal noise
- **windy**: Wind effects on IMU and GPS
- **noisy-imu**: Poor IMU calibration simulation
- **urban-gps**: GPS multipath and interference

### Features
- Realistic telemetry data with deterministic seeds
- Simulated satellite passes and tracking
- Procedural system events and alerts
- Full UI functionality without hardware dependencies

## 🔒 Safety Features

### Software Safety Systems
- **Soft Limits**: Configurable angle limits per axis
- **Rate Limiting**: Maximum movement speed enforcement
- **Emergency Stop**: Immediate halt of all motion
- **Limit Switches**: Hardware end-stop integration
- **Stall Detection**: Automatic protection for elevation/cross-level

### Security Considerations
- **Local Network Only**: No cloud connectivity
- **Command Whitelisting**: CLI restricted to safe operations
- **Input Validation**: All movement commands validated
- **Session Management**: Optional user authentication

## 📊 API Reference

### REST Endpoints
```
GET  /api/health              - System health check
GET  /api/config              - Get system configuration
PUT  /api/config              - Update configuration
POST /api/servos/{axis}/move  - Move servo to position
POST /api/servos/{axis}/stop  - Emergency stop servo
POST /api/cli                 - Execute whitelisted command
POST /api/demo                - Control demo mode
```

### WebSocket Channels
```
/ws/telemetry  - Real-time telemetry stream (10Hz)
/ws/logs       - System log stream
/ws/health     - Health status updates
```

### Data Contracts
All telemetry data uses strongly-typed interfaces with ISO-8601 timestamps and degree units by default. See `backend/models/telemetry.py` for complete type definitions.

## 🧪 Testing

### Frontend Tests
```bash
cd frontend
npm run test          # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
npm run storybook     # Component documentation
```

### Backend Tests
```bash
cd backend
pytest                # Unit and integration tests
pytest --cov         # Coverage report
```

### Hardware Tests
```bash
# Demo mode testing
curl -X POST http://localhost:9000/api/demo -d '{"enabled": true, "profile": "lab"}'

# CLI testing
curl -X POST http://localhost:9000/api/cli -d '{"command": "status"}'
```

## 📈 Performance

### Optimizations
- **Frontend**: Code splitting, lazy loading, efficient re-renders
- **Backend**: Async I/O, connection pooling, data streaming
- **WebSocket**: Efficient JSON serialization, rate limiting
- **3D Rendering**: LOD system, frustum culling, frame rate limiting

### Resource Usage
- **RAM**: ~500MB typical, ~1GB peak
- **CPU**: ~15% average on RPi 4B
- **Network**: ~10KB/s telemetry stream
- **Storage**: ~100MB base, grows with logs

## 🔄 Updates and Maintenance

### Updating the Application
```bash
cd /opt/aetherlink
sudo systemctl stop aetherlink
git pull origin main
sudo docker-compose build
sudo systemctl start aetherlink
```

### Log Management
```bash
# View real-time logs
sudo journalctl -u aetherlink -f

# Application logs
docker-compose logs -f aetherlink

# Log rotation (automatic via systemd)
sudo systemctl restart systemd-journald
```

### Backup and Recovery
```bash
# Backup configuration and data
sudo tar -czf aetherlink-backup-$(date +%Y%m%d).tar.gz \
  /etc/aetherlink \
  /opt/aetherlink/data

# Database backup
sqlite3 /opt/aetherlink/data/aetherlink.db ".backup backup.db"
```

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Run full test suite
5. Submit pull request

### Code Standards
- **TypeScript**: Strict mode, proper typing
- **Python**: Type hints, black formatting, pylint compliance
- **Components**: Documented in Storybook
- **API**: OpenAPI/Swagger documentation

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

### Documentation
- [Hardware Setup Guide](docs/hardware-setup.md)
- [API Documentation](docs/api.md)
- [Troubleshooting](docs/troubleshooting.md)

### Getting Help
- GitHub Issues for bug reports
- Discussions for questions and ideas
- Wiki for community documentation

## 🙏 Acknowledgments

- **INAV Project**: UI/UX inspiration and design patterns
- **Mission Control**: Aesthetic and operational concepts
- **Open Source Libraries**: React, FastAPI, Three.js, and many others

---

**AetherLink** - Professional satellite tracking made simple. 🛰️