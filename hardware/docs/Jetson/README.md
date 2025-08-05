# 🚀 AetherLink: Jetson AGX Orin System Setup

This document captures the baseline setup, environment configuration, and ongoing system maintenance procedures used for the [AetherLink SATCOM Project](https://github.com/YOUR_REPO). It is based on the **NVIDIA Jetson AGX Orin 64GB Developer Kit** and adheres to best practices from the [Jetson Linux Developer Guide (R36.4.4)](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/index.html).

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

## ⚖️ Important Note on Jetson GPIO (40-pin Header Issues)

The NVIDIA Jetson AGX Orin Developer Kit does **not support GPIO on the 40-pin header by default**, due to the **default pinmux settings** assigning many pins to alternate (SFIO) functions such as I2C, UART, or audio clocks.

### 📍 Use Case: Azimuth Limit Switch

In this project, **Pin 7** on the 40-pin header is used as an **input for the reed switch limit detection** on the azimuth servo. This pin maps to:

* **Verilog Ball Name**: `SOC_GPIO33`
* **Package Ball Name**: `GP66`
* **Customer Usage**: `GPIO3_PQ.06`
* **Devkit Usage**: `MCLK05_MCLK_40PIN`

This pin is assigned to **MCLK05** (a master clock) by default and must be reassigned as a GPIO input.

---

### 🛠️ Fix: Use the Jetson Pinmux Configuration Tool

NVIDIA provides a macro-enabled spreadsheet that allows you to safely reassign the pinmux functionality and generate device tree source files.

* **Download Tool**:
  📅 [Jetson AGX Orin Series Pinmux Config Tool](https://developer.nvidia.com/embedded/downloads#?search=pinmux)

> ⚠️ This tool **requires Microsoft Excel on Windows**. Most Linux spreadsheet tools will not run macros.

---

### 🔧 What to Modify

1. **Open** the `.xlsm` in **Excel (Windows)**.
2. Locate the row for **Pin 7**:

   * Pin: `L57`, Verilog: `SOC_GPIO33`, Ball: `GP66`
3. Modify:

   * **Function**: `gpio`
   * **Direction**: `input`
   * **Pull**: `up`
   * **Initial State**: `high`
   * **3.3V Tolerance**: `enable`
4. Use the spreadsheet macro to generate `.dtsi` and `.cfg` files.

---

### 🔪 Alternative: CLI Pin Configuration (Temporary Only)

You can also configure GPIO direction from the command line using `gpiod`:

```bash
gpioset gpiochip4 6=1  # Example: set GPIO3_PQ.06 high
```

> ⚠️ However, this **does not persist after reboot** and is **overridden by any loaded device tree overlay** that conflicts with the setting.

---

### 🛠️ Apply the Overlay

```bash
# Compile the DTS file
dtc -I dts -O dtb -o pin7_overlay.dtbo pin7_overlay.dts

# Copy to firmware directory
sudo cp pin7_overlay.dtbo /boot/firmware/

# Edit extlinux.conf
sudo nano /boot/extlinux/extlinux.conf
# Add to FDT or overlays line:
# FDT /boot/firmware/pin7_overlay.dtbo
```

Reboot to apply:

```bash
sudo reboot
```

Verify:

```bash
sudo cat /proc/device-tree/overlays/
```

---

### 📂 Sample `pin7_overlay.dts`

```dts
/dts-v1/;
/plugin/;

/ {
    jetson-header-name = "Jetson 40pin Header";
    overlay-name = "Pin 7 GPIO Bidirectional";
    compatible = "nvidia,p3737-0000+p3701-0005";

    fragment@0 {
        target = <&pinmux>;

        __overlay__ {
            pinctrl-names = "default";
            pinctrl-0 = <&jetson_io_pinmux>;

            jetson_io_pinmux: header-pinmux {
                hdr40-pin7 {
                    nvidia,pins = "soc_gpio33_pq6";
                    nvidia,function = "gpio";
                    nvidia,pull = <1>;         // 1 = pull-up
                    nvidia,tristate = <0>;      // 0 = driven
                    nvidia,enable-input = <1>;  // 1 = input enabled
                    nvidia,io-high-voltage = <1>; // 3.3V logic
                };
            };
        };
    };
};
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

## 🔭 Recommended Next Steps

* ✅ \[ ] Configure persistent systemd services for motor calibration on boot
* ✅ \[ ] Implement watchdog for comms loss with motors
* ✅ \[ ] Finish integration with HackRF and signal strength feedback loop
* ✅ \[ ] Auto-connect to Wi-Fi and push logs to cloud

---

## 📌 References

* 📚 [Jetson Linux Developer Guide R36.4.4](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/index.html)
* 🧰 [Jetson AGX Orin Hardware Overview](https://developer.nvidia.com/embedded/jetson-agx-orin-devkit)
* 🛠️ [JetsonHacks GPIO Patch](https://github.com/JetsonHacks/jetson-agx-orin-gpio-patch)
* 🛡️ [AetherLink SATCOM GitHub Repository](https://github.com/YOUR_REPO)
* 🔧 [Jetson SDK Manager](https://developer.nvidia.com/jetson-sdk-manager)
* ⚙️ [NVIDIA JetPack Archive](https://developer.nvidia.com/embedded/jetpack-archive)
* 🔫 [Jetson Pinmux Config Tool](https://developer.nvidia.com/embedded/downloads#?search=pinmux)
