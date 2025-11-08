# AetherLink SATCOM Antenna Control System

A modular, software-defined SATCOM antenna control system built for precise multi-axis tracking, signal intelligence, and future AI-enhanced automation. Designed for salvaged hardware and powered by the NVIDIA Jetson AGX Orin or Raspberry Pi, AetherLink enables real-time satellite targeting and SDR-based signal acquisition via an intuitive web interface.

## 🌟 Key Features

- **Multi-axis Control**: Azimuth, elevation, and pan control via MKS Servo57C/D + NEMA motors
- **Sensor Fusion**: GPS and IMU sensor fusion for orientation mapping
- **Real-time Interface**: Satellite selection interface with real-time positioning
- **Signal Intelligence**: Beacon-based fine-tuning and signal strength box scanning
- **SDR Integration**: HackRF One signal integration and spectral analysis
- **Expandable**: LEO/MEO/HEO tracking and camera-based LOS validation

## 🏗️ Project Structure

```
aetherlink/
├── hardware/                   # Hardware abstraction layer
│   ├── gps/                   # GPS modules (M10-25Q, BU353N)
│   ├── imu/                   # IMU modules (WT901C)
│   ├── motors/                # Servo control (MKS Servo57D)
│   └── database/              # Hardware state storage
├── webapp/                    # Main web application
│   ├── backend/               # FastAPI backend
│   └── frontend/              # React + Vite frontend
├── satcat-backend/            # Satellite catalog microservice
│   ├── src/                   # TypeScript source
│   └── prisma/                # Database schema
├── scripts/                   # System management scripts
│   ├── start-webapp.sh        # Complete startup
│   ├── stop-webapp.sh         # Graceful shutdown
│   └── start-*.sh             # Individual services
├── docs/                      # Comprehensive documentation
│   ├── manuals/               # PDF hardware datasheets
│   └── examples/              # Code examples
├── images/                    # Static assets
│   ├── 3d/                    # 3D models (.glb files)
│   └── icons/                 # UI icons and favicons
├── temp/                      # Runtime logs and PIDs (gitignored)
└── venv/                      # Python virtual environment
```

## 🚀 Quick Start

### Prerequisites

- Raspberry Pi 4B or NVIDIA Jetson AGX Orin
- Ubuntu 20.04+ or compatible Linux
- Python 3.11+
- Node.js 18+ (for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/aetherlink.git
   cd aetherlink
   ```

2. **Set up Python environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r webapp/backend/requirements.txt
   ```

3. **Set up frontend (development)**
   ```bash
   cd webapp/frontend
   npm install
   cd ../..
   ```

4. **Start the system**
   ```bash
   # Start webapp (auto-detects hardware)
   ./start-webapp.sh
   ```

### Running the System

**Start everything (recommended):**
```bash
./start-webapp.sh
```

**Individual services:**
```bash
# Backend only
./scripts/start-backend.sh

# Frontend only (development)
./scripts/start-frontend.sh

# Servo API only
./scripts/start-servo-api.sh
```

**Stop or restart:**
```bash
./stop-webapp.sh
./restart-webapp.sh
```

### Access URLs

- **Frontend**: http://localhost:3001 (or your Pi's IP)
- **Backend API**: http://localhost:9000/docs
- **Swagger UI**: http://localhost:9000/docs

### First Time Setup

1. **Hardware Connection**: Connect your GPS, IMU, and servo motors
2. **Auto-Detection**: The system auto-detects connected USB devices
3. **Start System**: Run `./start-webapp.sh`
4. **Access Interface**: Open http://localhost:3001 in your browser
5. **Configure Firewall**: Allow ports 3001 and 9000 if accessing remotely

## 🔧 Hardware Support

### GPS Module
- **Model**: u-blox M10-25Q via UART
- **Port**: `/dev/ttyAMA0` @ 115200 baud
- **Features**: Multi-GNSS, compass, satellite diagnostics

### IMU Module
- **Model**: WitMotion WT901C-TTL 9-axis sensor
- **Port**: `/dev/ttyUSB1` @ 9600 baud
- **Features**: Accelerometer, gyroscope, magnetometer, barometer

### Servo Motors
- **Model**: MKS Servo57D via RS485
- **Port**: `/dev/ttyUSB0` @ 38400 baud
- **Addresses**: Azimuth (1), Elevation (2), Cross-level (3)

### Limit Switches
- **Type**: Normally-open limit switches
- **Purpose**: Azimuth range detection and safety

## 🎯 Usage

### Web Interface

1. **Dashboard**: 3D globe with real-time antenna position
2. **Modules**: Individual hardware component configuration
3. **Configuration**: System settings and safety parameters
4. **CLI**: Embedded terminal with whitelisted commands
5. **Logs**: Real-time system monitoring and alerts

### Hardware APIs

Standalone APIs for testing and integration:

```bash
# GPS API
python -m hardware.gps.m10_25q_api --host 0.0.0.0 --port 8083

# IMU API
python -m hardware.imu.wt901c_api --host 0.0.0.0 --port 8084

# Servo API
python -m hardware.motors.servo57d_api --host 0.0.0.0 --port 8085
```

### Web Interface Features

The main web application provides:

- **Dashboard**: Interactive 3D globe with Cesium for satellite visualization
- **Satellite Catalog**: Search and filter 8,000+ satellites with TLE data
- **Module Controls**: Individual hardware component management
- **SDR Integration**: HackRF One spectrum analyzer and signal monitoring
- **Live Telemetry**: Real-time GPS, IMU, and servo position data
- **Orbital Mechanics**: TLE parsing with classical orbital elements display

## 📚 Documentation

- **[Hardware Guides](docs/)**: Detailed hardware setup and configuration
- **[Webapp Guide](docs/WEBAPP_STARTUP_GUIDE.md)**: Complete webapp setup
- **[SDR Setup](docs/SDR_MODULE_SETUP.md)**: HackRF One configuration
- **[Troubleshooting](docs/TROUBLESHOOTING.md)**: Common issues and solutions
- **[Architecture](docs/ARCHITECTURE.md)**: System design and components
- **[Deployment](docs/DEPLOYMENT.md)**: Production deployment guide

### Quick Reference

- **Startup Scripts**: Root directory (`./start-webapp.sh`, `./stop-webapp.sh`)
- **Hardware Drivers**: `hardware/` directory
- **Web Application**: `webapp/` directory (backend + frontend)
- **Satellite Catalog**: `satcat-backend/` microservice
- **Runtime Files**: `temp/` directory (logs, PIDs)

## 🛠️ Development

### Backend Development

```bash
cd webapp
PYTHONPATH=/path/to/aetherlink python -m uvicorn backend.main:app --reload
```

### Frontend Development

```bash
cd webapp/frontend
npm run dev
```

### Hardware Testing

```bash
# Activate venv first
source venv/bin/activate

# Test GPS
python -m hardware.gps.m10_25q_test

# Test IMU
python -m hardware.imu.wt901c_test

# Test motors (from hardware/motors/)
cd hardware/motors && python test_limit_protection.py
```

## 🐳 Docker Deployment

```bash
cd webapp
docker-compose up -d
```

## 🔒 Security Notes

- **Network Access**: Services bound to `0.0.0.0` (accessible from network)
- **Authentication**: Not currently implemented
- **HTTPS**: Not configured (HTTP only)
- **Firewall**: Configure UFW for production use

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔧 Troubleshooting

### Common Issues

1. **Port conflicts**: Use `./stop-webapp.sh` before restarting
2. **Hardware not detected**: Check USB connections and /dev/ttyUSB* permissions
3. **Import errors**: Ensure you're in the project root and venv is activated
4. **Permission denied**: Run `chmod +x *.sh` on startup scripts
5. **Frontend build errors**: Increase Node memory with `NODE_OPTIONS="--max-old-space-size=4096"`

### Diagnostic Commands

```bash
# Check system status
./start-webapp.sh  # Shows detailed startup info and hardware detection

# View logs
tail -f temp/backend.log
tail -f temp/frontend.log

# Test GPS connection
source venv/bin/activate
python -m hardware.gps.m10_25q_test

# Test IMU connection
python -m hardware.imu.wt901c_test

# List USB serial devices
ls -la /dev/ttyUSB* /dev/ttyAMA*
```

### Getting Help

- **Issues**: Submit issues on GitHub
- **Documentation**: Comprehensive guides in `docs/` directory
- **Hardware**: Refer to `docs/manuals/` for PDF datasheets
- **Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design

---

*Built with ❤️ for the satellite communication community*
