# AetherLink

_AetherLink_ is a modular, software-defined SATCOM antenna control system built for precise multi-axis tracking, signal intelligence, and future AI-enhanced automation. Designed for salvaged hardware and powered by the NVIDIA Jetson AGX Orin, AetherLink enables real-time satellite targeting and SDR-based signal acquisition via an intuitive web interface.

## Key Features
- Azimuth, elevation, and pan control via MKS Servo57C/D + NEMA motors
- GPS and IMU sensor fusion for orientation mapping
- Satellite selection interface with real-time positioning
- Beacon-based fine-tuning and signal strength box scanning
- HackRF One signal integration and spectral analysis
- Expandable to LEO/MEO/HEO tracking and camera-based LOS validation

## Project Structure
See `/docs/architecture.md` for full layout, or jump into `/software/` for subsystems.

## Setup
Run the install script on Jetson AGX Orin:

```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

## Folder Structure
AetherLink/
├── main.py
├── scripts/
│   ├── install.sh
│   ├── start.sh
│   └── test_motors.py
├── software/
│   ├── config/settings.yaml
│   ├── controller/calibration.py
│   ├── sensors/gps_parser.py
│   ├── sensors/imu_parser.py
│   └── sdr/box_scan.py
├── examples/sample_satellite.json
├── LICENSE
├── .gitignore
