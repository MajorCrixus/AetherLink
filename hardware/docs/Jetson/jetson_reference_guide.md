# 📚 Jetson AGX Orin Reference Guide

This document contains supporting tools, diagrams, and commands used throughout the AetherLink project. It is not intended as a setup or instructional guide, but rather as a helpful supplement to:

* [system\_setup.md](../../system_setup.md)
* [gpio\_usage\_guide.md](../../gpio_usage_guide.md)

---

## 📌 Jetson 40-Pin Header Pinout (AGX Orin)

> Visual reference from NVIDIA documentation

<p>
  <img alt="Jetson Orin 40-pin White" src="https://developer.download.nvidia.com/embedded/images/jetsonAgxOrin/getting_started/jao_cbspec_figure_3-4_white-bg.png#only-light">
  <img alt="Jetson Orin 40-pin Black" src="https://developer.download.nvidia.com/embedded/images/jetsonAgxOrin/getting_started/jao_cbspec_figure_3-4_black-bg.png#only-dark">
</p>

📖 Source: [Jetson Linux Developer Guide – Expansion Headers](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/HR/ConfiguringTheJetsonExpansionHeaders.html)

---

## 🛠️ Useful Commands & Utilities

### Launch Jetson-IO Pin Configuration Tool

```bash
sudo /opt/nvidia/jetson-io/jetson-io.py
```

### Check Device Model

```bash
cat /proc/device-tree/model
```

### Check L4T / JetPack Version

```bash
head -n 1 /etc/nv_tegra_release
```

### List Detected GPIO Chips

```bash
ls /dev/gpiochip*
gpiodetect
```

### Disassemble Active Device Tree

```bash
sudo dtc -I dtb -O dts -o extracted.dts /boot/firmware/<your-dtb-file>
```

---

## 🧬 Jetson Tools & Resources

| Tool           | Purpose                           | Notes                                  |
| -------------- | --------------------------------- | -------------------------------------- |
| `jetson-io.py` | Configure 40-pin header           | Interactive CLI utility                |
| `jtop`         | Live system telemetry             | Install via `pip install jetson-stats` |
| `tegrastats`   | Monitor temps/load/resource usage | Built-in binary                        |
| `dtc`          | Compile/decompile device trees    | For DTS ⇄ DTBO conversion              |

---

## 🔗 Related Links

* [Jetson Developer Downloads](https://developer.nvidia.com/embedded/downloads)
* [Device Tree Overlay Concepts (JetsonHacks)](https://jetsonhacks.com/2025/04/07/device-tree-overlays-on-jetson-scary-but-fun/)
* [Jetson Expansion Header Configuration](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/HR/ConfiguringTheJetsonExpansionHeaders.html)
* [AetherLink Project Repo](https://github.com/MajorCrixus/AetherLink)
