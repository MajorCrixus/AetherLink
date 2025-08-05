# 🧪 Diagnostics Tools (`tools/diagnostics/`)

This directory contains utilities designed to **verify GPIO functionality**, **validate pinmux behavior**, and **troubleshoot runtime issues** on the Jetson AGX Orin system.

These scripts aid in diagnosing whether pin configuration changes (e.g., overlays) are taking effect, and whether GPIO lines can be accessed as expected.

---

## 🧪 [`gpio_test.py`](./gpio_test.py)

Performs basic input/output tests on Jetson header pins using both `Jetson.GPIO` and `gpiod` backends. Useful after overlay application or boot to ensure GPIO is functioning.

### ✅ Features
- Supports both `Jetson.GPIO` and `gpiod` libraries
- Accepts CLI arguments for pin number and mode (input/output)
- Optional pulse generation for output pins
- Displays live pin readout for input mode
- Detects GPIO errors and provides status output

### 🎯 Goals
- Verify whether overlays or pinmux changes have taken effect
- Enable rapid testing of GPIO functionality on any Jetson header pin
- Simplify diagnostics of input lines like limit switches

### ⚙️ Usage
```bash
source ~/venv/bin/activate
python3 gpio_test.py --mode input --pin 7 --library gpiod
```
> Use inside your Python virtual environment (if configured).

### 📦 Dependencies
- `gpiod` v2.3.0+
- `Jetson.GPIO` (if selected as backend)
- Python 3.8+
- `argparse`, `time` (standard libraries)

### 🛡️ Best Practices
- Use `--mode input` to validate external switch circuits (e.g., reed limit switches)
- Always test after a reboot to verify overlay persistence
- Use the `--verbose` flag (if implemented) for detailed trace

### 🔗 Related Documentation
- [`system_setup.md`](../../system_setup.md#gpio)
- [GPIO Setup Guide](../../hardware/docs/Jetson/gpio_setup.md)
- [Jetson Linux Developer Guide - GPIO](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/HR/ConfiguringTheJetsonExpansionHeaders.html#configuring-gpio-pins)

---

## 🧪 [`check_versions.py`](./check_versions.py)

Validates the Jetson software environment by checking for expected versions of system packages and Python libraries critical to AetherLink.

### ✅ Features
- Verifies JetPack, L4T, Ubuntu, Python, Jetson.GPIO, and gpiod versions
- Prints expected vs. actual versions with warnings for mismatches
- Works well during onboarding or system troubleshooting

### 🎯 Goals
- Ensure environment consistency across devices
- Detect mismatches after system updates or SDK Manager reflashes
- Prevent hard-to-debug GPIO or package compatibility issues

### ⚙️ Usage
```bash
source ~/venv/bin/activate
python3 check_versions.py
```
> Recommended inside a configured virtual environment for Python library checks.

### 📦 Dependencies
- Python 3.8+
- `Jetson.GPIO`, `gpiod`, `dpkg`, `lsb_release` (standard packages/tools)

### 🛡️ Best Practices
- Run this tool after any JetPack upgrade or pip install
- Maintain matching environments for all Jetson developer kits used in the project

### 🔗 Related Documentation
- [`system_setup.md`](../../system_setup.md#🧰-software-stack-&-versions)
- [Jetson Linux Developer Guide - JetPack](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/intro.html#jetpack-components)
- [Jetson SDK Manager](https://developer.nvidia.com/jetson-sdk-manager)

---

## 🧪 [`overlay_inspect.py`](./overlay_inspect.py)

Inspects overlay application status on the Jetson AGX Orin by checking both the `/proc/device-tree/overlays` directory and `extlinux.conf` for references to loaded `.dtbo` overlays.

### ✅ Features
- Verifies if overlays (e.g., pin7 overlay) were loaded at boot
- Scans for specific overlays like `pin7_overlay` (optional)
- Parses boot configuration file to trace overlay setup
- Graceful fallback with error handling if files are missing

### 🎯 Goals
- Help diagnose cases where expected GPIO behavior isn’t taking effect
- Confirm overlay installation and bootloader integration
- Assist users in debugging boot-time DTS misconfigurations

### ⚙️ Usage
```bash
python3 overlay_inspect.py
```
> Run as a system-wide diagnostic tool after a reboot or DTS deployment.

### 📦 Dependencies
- Python 3.8+
- `os`, `argparse`, `pathlib`, `re` (standard libraries)

### 🛡️ Best Practices
- Use after applying `.dtbo` files and rebooting
- Pair with `gpio_test.py` to confirm pin function changes

### 🔗 Related Documentation
- [`system_setup.md`](../../system_setup.md#🛠️-apply-the-overlay)
- [JetsonHacks Overlay Guide](https://jetsonhacks.com/2025/04/07/device-tree-overlays-on-jetson-scary-but-fun/)
- [Jetson Linux Developer Guide - Device Tree](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/DTOverlays.html)

---

## 🧪 [`power_diag.py`](./power_diag.py)

Monitors system power usage and key voltage rails using `tegrastats`, enabling real-time tracking of CPU, GPU, and DDR power draw.

### ✅ Features
- Uses `tegrastats` to extract per-rail power usage
- Supports continuous monitoring with adjustable polling interval
- Logs output to CSV (optional flag)
- Displays average and peak power draw over runtime
- System-wide (no virtual environment required)

### 🎯 Goals
- Detect power instability or overdraw from connected hardware (e.g. servos, SDRs)
- Confirm healthy operation of system rails under various loads
- Provide engineers with actionable power data during field tests

### ⚙️ Usage
```bash
python3 power_diag.py --interval 2 --duration 60 --log power_log.csv
```
> Logs power draw every 2 seconds for 60 seconds and writes to `power_log.csv`

### 📦 Dependencies
- Python 3.8+
- `subprocess`, `re`, `csv`, `time`, `datetime`, `argparse` (standard libraries)

### 🛡️ Best Practices
- Run during servo motion or SDR tuning phases to observe impact on power
- Use log output to compare sessions and analyze long-term behavior

### 🔗 Related Documentation
- [`system_setup.md`](../../system_setup.md#power-and-thermal-considerations)
- [Jetson Linux Developer Guide - `tegrastats`](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/MonitoringResources.html#tegrastats)

---
