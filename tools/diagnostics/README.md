# 🧪 GPIO Diagnostics Tool – `gpio_test.py`

This script provides a basic GPIO diagnostic interface for the Jetson AGX Orin platform. It is part of the `tools/diagnostics/` directory for the AetherLink SATCOM project.

## 📄 Overview

The `gpio_test.py` script helps verify pin configuration and state for GPIO pins exposed via the 40-pin header. It supports both the Jetson.GPIO library and the `gpiod` (libgpiod v2) interface and can be run as a CLI tool or imported as a Python module.

## ⚙️ Features

* Automatically detects whether `Jetson.GPIO` or `gpiod` is available
* Allows setting pin direction and reading pin state
* Minimal dependency footprint (uses `typer` for CLI)
* Useful for testing overlays, limit switches, and GPIO behavior post-reboot

## 🚀 Goals

* Confirm Pin 7 (or others) is usable as an input/output
* Validate pinmux overlay application
* Provide a quick status check after system changes or reboots

## 🧾 Usage

Activate your project environment:

```bash
source ~/venv/bin/activate
```

Run the test script:

```bash
python gpio_test.py --pin 7 --direction in
```

List options:

```bash
python gpio_test.py --help
```

Expected output:

```
📍 Pin 7 configured as input
🟢 Pin 7 state is: HIGH
```

## 🧱 Dependencies

```bash
pip install typer rich
```

Optional (if Jetson.GPIO is used):

```bash
pip install Jetson.GPIO
```

## 📁 Related Files

* [`gpio_test.py`](./gpio_test.py): Main diagnostic script for testing GPIO pin functionality

## 🔗 References

* [Jetson.GPIO Documentation](https://github.com/NVIDIA/jetson-gpio)
* [libgpiod](https://git.kernel.org/pub/scm/libs/libgpiod/libgpiod.git/about/)
* [System Setup Guide](../../System%20Setup.md)
* [Jetson Developer Guide – Configuring GPIO](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/HR/ConfiguringTheJetsonExpansionHeaders.html)

---

✅ Be sure to verify overlays were applied and rebooted before running GPIO diagnostics.
