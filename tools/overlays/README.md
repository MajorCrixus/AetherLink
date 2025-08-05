# 🧩 Overlay Tools (`tools/overlays/`)

This directory contains scripts and device tree source files used to configure and apply **GPIO and other pinmux-related overlays** for the Jetson AGX Orin platform. These are critical when repurposing pins on the 40-pin header or enabling functionality not provided in the stock Jetson device tree.

---

## 📄 [`apply_overlay.sh`](./apply_overlay.sh)

Automates the end-to-end process of managing device tree overlays. This script is used for compiling `.dts` files into `.dtbo` format, placing them in the correct boot directory, modifying `extlinux.conf`, and prompting for reboot.

### ✅ Features

* Automates DTS to DTBO compilation using `dtc`
* Installs overlays to `/boot/firmware/`
* Automatically backs up and patches `extlinux.conf`
* Handles duplicate entries gracefully
* Provides verbose status output with error handling

### 🎯 Goals

* Reduce manual effort and prevent misconfiguration
* Simplify the deployment of device tree overlays
* Provide a reproducible method to manage GPIO assignments

### ⚙️ Usage

```bash
sudo ./apply_overlay.sh pin7_overlay.dts
```

> This script should be run from a **non-virtual environment** shell with root privileges.

### 📦 Dependencies

* `dtc` (Device Tree Compiler)
* Bash (Unix shell)
* Superuser (sudo) permissions

### 🛡️ Best Practices

* Always keep a backup of `extlinux.conf` before patching
* Reboot after running the script to ensure overlays are applied
* Maintain overlays in version control to track changes
* Ensure your `.dts` file matches your board and carrier config

### 🔗 Related Documentation

* [Jetson Linux Developer Guide - Configuring Expansion Headers](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/HR/ConfiguringTheJetsonExpansionHeaders.html)
* [JetsonHacks: Device Tree Overlays on Jetson](https://jetsonhacks.com/2025/04/07/device-tree-overlays-on-jetson-scary-but-fun/)
* [`system_setup.md`](../../system_setup.md)

---

## 📂 Sample Device Tree Source Files

### 📄 [`pin7_overlay.dts`](./pin7_overlay.dts)

Configures **40-pin header Pin 7** (`SOC_GPIO33`) for GPIO use with internal pull-up. Used in this project for the **azimuth servo limit switch** input.

#### Pin Mapping

| Header Pin | SoC Ball Name | Usage                      |
| ---------- | ------------- | -------------------------- |
| 7          | `SOC_GPIO33`  | Azimuth limit switch input |

#### Key Configuration Flags

```dts
nvidia,function = "gpio";
nvidia,pull = <1>;         // Pull-up
nvidia,tristate = <0>;     // Drive enabled
nvidia,enable-input = <1>; // Input enabled
nvidia,io-high-voltage = <1>; // 3.3V
```

> This DTS file is not executable and does not require a virtual environment.

### 🛡️ Best Practices

* Make sure to validate pin name compatibility in the pinmux spreadsheet tool
* When in doubt, use external resistors in addition to internal pull config
* Use overlays instead of CLI-based GPIO manipulation for reliability

### 🔗 Related Documentation

* [Pinmux Configuration Tool](https://developer.nvidia.com/embedded/downloads#?search=pinmux)
* [Pin 7 DTS Usage in `system_setup.md`](../../system_setup.md)
* [GPIO Setup Guide](../../hardware/docs/Jetson/gpio_setup.md)
