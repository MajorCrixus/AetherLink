# 🧪 Jetson AGX Orin GPIO Usage & Verification Guide

This guide serves as a hands-on reference for working with GPIO on the NVIDIA Jetson AGX Orin. It focuses on runtime tools and methods for configuring, testing, and verifying GPIO pins exposed via the 40-pin expansion header.

> For pinmux changes and persistent overlay configuration, see [system\_setup.md](../../system_setup.md).

---

## 🔍 Low-Level Hardware & OS Verification

### Detect Jetson Model

```bash
cat /proc/device-tree/model
```

> Example output: `NVIDIA Jetson AGX Orin Developer Kit`

### Check JetPack / L4T Version

```bash
head -n 1 /etc/nv_tegra_release
```

> Example output: `# R36 (release), REVISION: 4.4, GCID: 41062509, BOARD: generic, EABI: aarch64`

---

## 🧱 GPIO Chip Visibility (gpiod/libgpiod)

### Enumerate GPIO Chips

```bash
ls /dev/gpiochip*
```

```bash
gpiodetect
```

> Example output:

```
gpiochip0 [tegra234-gpio] (164 lines)
gpiochip1 [tegra234-gpio-aon] (32 lines)
gpiochip2 [ftdi-cbus] (4 lines)
```

---

## 🐍 Install Jetson.GPIO (Runtime Control)

### 1. Create Python Virtual Environment

```bash
cd /path/to/your/project
python3 -m venv venv
source venv/bin/activate
```

> After activation, your prompt will change to reflect the virtual environment.

### 2. Install Jetson.GPIO

```bash
pip install Jetson.GPIO
```

### 3. Verify Installation

```bash
python3 -c "import Jetson.GPIO as GPIO; print(GPIO.VERSION)"
```

---

## 🛡️ User Permissions & Rules

### 1. Ensure user is in `gpio` group

```bash
groups
```

If `gpio` is not listed:

```bash
sudo groupadd -f -r gpio
sudo usermod -a -G gpio $USER
```

### 2. Add udev rule

```bash
sudo cp /usr/local/lib/python*/dist-packages/Jetson/GPIO/99-gpio.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### 3. Reboot

```bash
sudo reboot
```

---

## ✅ Summary

| Step                        | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `jetson-io.py`              | Set up default 40-pin header pinmux            |
| `gpiodetect` / `gpioset`    | Inspect and manipulate GPIO pins via CLI       |
| `Jetson.GPIO` + Python      | Use GPIO in scripts and projects               |
| `udev` + `gpio` group setup | Allow non-root access to GPIO                  |
| `.dtbo` overlays            | Persistent GPIO pinmux config (see main guide) |

---

## 🔗 Related Resources

* [Jetson Linux GPIO Docs (R36.4.4)](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/HR/ConfiguringTheJetsonExpansionHeaders.html#installing-gpiod)
* [AetherLink system\_setup.md](../../system_setup.md)
