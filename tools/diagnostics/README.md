# 🧪 Diagnostics Tools (`tools/diagnostics/`)

This directory contains utilities designed to **verify GPIO functionality**, **validate pinmux behavior**, and **troubleshoot runtime issues** on the Jetson AGX Orin system.

These scripts aid in diagnosing whether pin configuration changes (e.g., overlays) are taking effect, and whether GPIO lines can be accessed as expected.

---

## 🧪 [`gpio_test.py`](./gpio_test.py)

Performs basic input/output tests on Jetson header pins using both `Jetson.GPIO` and `gpiod` backends. Useful after overlay application or boot to ensure GPIO is functioning.

### ✅ Features

* Supports both `Jetson.GPIO` and `gpiod` libraries
* Accepts CLI arguments for pin number and mode (input/output)
* Optional pulse generation for output pins
* Displays live pin readout for input mode
* Detects GPIO errors and provides status output

### 🎯 Goals

* Verify whether overlays or pinmux changes have taken effect
* Enable rapid testing of GPIO functionality on any Jetson header pin
* Simplify diagnostics of input lines like limit switches

### ⚙️ Usage

```bash
source ~/venv/bin/activate
python3 gpio_test.py --mode input --pin 7 --library gpiod
```

> Use inside your Python virtual environment (if configured).

### 📦 Dependencies

* `gpiod` v2.3.0+
* `Jetson.GPIO` (if selected as backend)
* Python 3.8+
* `argparse`, `time` (standard libraries)

### 🛡️ Best Practices

* Use `--mode input` to validate external switch circuits (e.g., reed limit switches)
* Always test after a reboot to verify overlay persistence
* Use the `--verbose` flag (if implemented) for detailed trace

### 🔗 Related Documentation

* [`system_setup.md`](../../system_setup.md#gpio)
* [GPIO Setup Guide](../../hardware/docs/Jetson/gpio_setup.md)
* [Jetson Linux Developer Guide - GPIO](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/HR/ConfiguringTheJetsonExpansionHeaders.html#configuring-gpio-pins)

---

## 🧩 Related Tools

This directory may later include:

* Serial line diagnostics (`uart_monitor.py`)
* Overlay status checkers (`overlay_inspect.py`)
* Power rail monitors (`power_diag.py`)

When added, each tool should follow the same structure with README coverage.
