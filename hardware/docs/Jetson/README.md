# 🚀 AetherLink: Jetson AGX Orin System Setup

This document captures the baseline setup, environment configuration, and ongoing system maintenance procedures used for the AetherLink SATCOM Project. It is based on the **NVIDIA Jetson AGX Orin 64GB Developer Kit** and adheres to best practices from the [Jetson Linux Developer Guide (R36.4.4)](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/index.html).

---

## 🔧 Hardware Platform

| Component      | Specification                                        |
| -------------- | ---------------------------------------------------- |
| Device         | NVIDIA Jetson AGX Orin Developer Kit                 |
| SoC            | NVIDIA Tegra Orin (8-core ARM v8.2 CPU + Ampere GPU) |
| RAM            | 64GB LPDDR5                                          |
| Storage        | 64GB eMMC + External NVMe SSD (optional)             |
| GPIO Expansion | 40-Pin Header                                        |
| Carrier Board  | P3737-0000                                           |
| Power Mode     | 60W MAXN or custom                                   |

---

## 🧰 Software Stack & Versions

| Component         | Version                     | Notes                                                                                          |
| ----------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| Jetson Linux      | R36.4.4                     | [Jetson Linux Docs](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/index.html) |
| JetPack           | 6.0 DP                      | Installed via SDK Manager or CLI                                                               |
| Ubuntu            | 20.04 LTS (arm64)           | NVIDIA's reference OS                                                                          |
| Python            | 3.8+ (system default)       | venv supported                                                                                 |
| Jetson.GPIO       | 2.1.1                       | [JetsonHacks GPIO Patch](https://github.com/JetsonHacks/jetson-agx-orin-gpio-patch) applied    |
| gpiod             | 2.3.0                       | For libgpiod v2 API support                                                                    |
| Pyserial          | latest                      | For RS485 control of MKS Servo57C                                                              |
| Minicom           | latest                      | For serial diagnostics                                                                         |
| Docker (optional) | 24.x                        | For isolated test environments                                                                 |
| Git               | latest                      | For version control                                                                            |
| OpenCV            | 4.x                         | Required for camera and image capture                                                          |
| Pygame            | 2.x                         | (Optional) Used in debug UIs                                                                   |
| Typer             | CLI tooling for Python apps |                                                                                                |

---

## 🧱 Jetson System Initialization (From Baseline)

```bash
# Update & Install Basic Tools
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git gpiod libgpiod-dev minicom screen curl wget build-essential

# Set up Python Virtual Environment (optional but recommended)
python3 -m venv ~/venv
source ~/venv/bin/activate
pip install --upgrade pip
```

### Flashing Jetson with JetPack 6.0 DP

Refer to official SDK Manager or CLI method:
📖 [Flashing Guide](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/flash_software.html)

---

## ⚙️ GPIO Setup (Bidirectional Patch for Pin 7)

1. **Install Jetson.GPIO**:

```bash
pip install Jetson.GPIO
```

2. **Apply GPIO Patch**:

```bash
git clone https://github.com/JetsonHacks/jetson-agx-orin-gpio-patch.git
cd jetson-agx-orin-gpio-patch
./install.sh  # Review before running
```

3. **Enable Pin 7 as Bidirectional**:
   Create and compile a custom overlay (example `.dts` provided in repo).

4. **Deploy .dtbo to `/boot/firmware/`** and update `/boot/extlinux/extlinux.conf`:

```bash
sudo cp pin7_overlay.dtbo /boot/firmware/
sudo nano /boot/extlinux/extlinux.conf
# Add to FDT entry or overlays
```

5. **Reboot and verify**:

```bash
sudo reboot
sudo cat /proc/device-tree/overlays/
```

---

## 🦪 System Diagnostics

| Tool                                 | Usage                                                                 |
| ------------------------------------ | --------------------------------------------------------------------- |
| `dmesg`                              | Kernel messages                                                       |
| `ls /dev/gpiochip*`                  | Detect gpiod chips                                                    |
| `gpiodetect` / `gpioset` / `gpioget` | Use libgpiod commands                                                 |
| `minicom -D /dev/ttyUSB0`            | Serial debug with MKS drivers                                         |
| `i2cdetect -y 1`                     | Check for I2C peripherals                                             |
| `sudo tegrastats`                    | Monitor performance/temps                                             |
| `jtop`                               | GUI-based telemetry monitor (install with `pip install jetson-stats`) |

---

## 🔀 Maintenance Tasks

```bash
# Check JetPack Version
dpkg-query --show nvidia-jetpack

# Check Jetson Model & Specs
sudo dmidecode -t system

# Clean up disk space
sudo apt autoremove -y
sudo apt clean
```

---

## 📌 References

* 📚 [Jetson Linux Developer Guide R36.4.4](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/index.html)
* 🧰 [Jetson AGX Orin Hardware Overview](https://developer.nvidia.com/embedded/jetson-agx-orin-devkit)
* 🛠️ [JetsonHacks GPIO Patch](https://github.com/JetsonHacks/jetson-agx-orin-gpio-patch)
* 🔧 [Jetson SDK Manager](https://developer.nvidia.com/jetson-sdk-manager)
* ⚙️ [NVIDIA JetPack Archive](https://developer.nvidia.com/embedded/jetpack-archive)
