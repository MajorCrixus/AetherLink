# Intellian OW70L SATCOM Antenna

## Overview

The **Intellian OW70L** is a stripped-down secondary SATCOM antenna that serves as the **backbone and inspiration** of the AetherLink project. This antenna platform provides the physical foundation upon which all other hardware components are integrated.

## Role in AetherLink

The OW70L antenna is not just a component—it's the **structural platform** that houses and enables the entire AetherLink system:

- **Mechanical Platform**: Provides the mounting structure for all control hardware
- **Multi-axis Movement**: Native azimuth, elevation, and cross-level positioning capabilities
- **Project Inspiration**: The salvaged OW70L sparked the vision for an open-source, modular SATCOM control system

## Hardware Integration

All AetherLink hardware modules are **self-contained within this antenna**:

| Component | Purpose | Integration |
|-----------|---------|-------------|
| **GPS** | Ground station positioning | Mounted internally |
| **IMU** | Antenna orientation sensing | Mounted to platform |
| **Motors** | Precision multi-axis control | Drive azimuth/elevation/cross-level |
| **SDR** | Signal monitoring and analysis | RF integration |
| **Computing** | Raspberry Pi 4B / Jetson AGX Orin | Central control system |

## Specifications

### OW70L Original Specs
- **Frequency Bands**: Ku-band (10.7-12.75 GHz RX, 14.0-14.5 GHz TX)
- **Antenna Diameter**: 70cm reflector
- **Stabilization**: 3-axis (azimuth, elevation, cross-level)
- **Mount Type**: Below-deck installation (modified for ground use)

### AetherLink Modifications
- **Removed**: Original proprietary control electronics
- **Added**: MKS Servo57D stepper motors with RS485 control
- **Added**: GPS + IMU sensor fusion for autonomous positioning
- **Added**: HackRF One SDR for signal intelligence
- **Added**: Open-source web-based control interface

## Documentation

- **[OW70L Manual](docs/OW70L.pdf)**: Original Intellian documentation
- **Motor Control**: See [../motors/README.md](../motors/README.md)
- **Sensor Fusion**: See [../gps/README.md](../gps/README.md) and [../imu/README.md](../imu/README.md)
- **SDR Integration**: See [../sdr/README.md](../sdr/README.md)

## Project Philosophy

The AetherLink project transforms a salvaged, proprietary SATCOM antenna into a **fully open-source, autonomous satellite tracking platform**. By replacing closed commercial electronics with:

- Open-source motor controllers
- Standard GNSS/IMU sensors
- Software-defined radio
- Modern web technologies

...we've created a system that's:
- ✅ **Educational**: Learn orbital mechanics, RF engineering, and control systems
- ✅ **Hackable**: Modify and extend for custom applications
- ✅ **Affordable**: Salvaged hardware + commodity components
- ✅ **Transparent**: Every line of code and circuit diagram is open

## Future Enhancements

Potential upgrades for the antenna platform:

- [ ] **RF Frontend**: Add LNB and transmit capabilities
- [ ] **Radome**: Weather protection for outdoor deployment
- [ ] **Camera Integration**: Visual LOS validation for satellite acquisition
- [ ] **Automatic Calibration**: Self-tuning based on beacon signals
- [ ] **Multi-band Support**: Add C-band and Ka-band capabilities

---

**The OW70L gave this project life—now it enables open satellite communication for everyone.** 🛰️
