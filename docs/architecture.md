# AetherLink Architecture

## Core Subsystems

- **Controller**: Interfaces with MKS servo drivers to move az/el/pan.
- **Sensors**: Reads GPS + IMU data, handles sensor fusion for positioning.
- **SDR**: Captures beacon signals, performs box scans, logs IQ data.
- **UI**: Presents satellite selection, signal feedback, safety controls.

## Startup Sequence

1. Boot system, run calibration.
2. Sensor fusion: heading, pitch, roll.
3. Fetch TLE, calculate satellite Az/El.
4. Move antenna.
5. Box scan + peak signal lock (HackRF).
6. Optionally decode or log RF signal.

## Hardware Stack
- 1 x Jetson AGX Orin Developer Kit
- 1 x NEMA 17 Servo (Non-standard model)
- 1 x MKS SERVO42D (Nema 17 256 Microstep Closed Loop Servo Driver Controller using RS485 communications)
- 2 x NEMA 23 Servos (Non-standard model)
- 2 x MKS SERVO57C (Nema 23 256 Microstep Closed Loop Servo Driver Controller using RS485 communications)
- 1 x Limit Switch (Azimuth)
- 1 x 9-axis DOF Acceleronometer/Gyroscope/Inclinometer/Compass (WITmotion WT901C-TTL)
- 1 x TTL-USB cable (WITmotion)
- 1 x GPS (Holybro M9N GNSS Receiver)
- 1 x SDR (HackRF) 
