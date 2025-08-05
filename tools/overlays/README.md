# 🧩 Overlay Tools (`tools/overlays/`)

This directory contains scripts and device tree source files used to configure and apply **GPIO and other pinmux-related overlays** for the Jetson AGX Orin platform. These are critical when repurposing pins on the 40-pin header or enabling functionality not provided in the stock Jetson device tree.

---

## 📄 [`apply_overlay.sh`](./apply_overlay.sh)

Automates the end-to-end process of:

* Compiling a `.dts` file into a `.dtbo` overlay
* Installing it into `/boot/firmware/`
* Patching the `extlinux.conf` boot configuration
* Prompting for reboot

### ✅ Features

* Robust error handling
* Status output for each step
* Backs up `extlinux.conf` before modifying
* Skips duplicate patch entries if overlay is already present

### 📦 Requirements

* `dtc` (Device Tree Compiler)
* Root privileges

### 🧪 Example Usage

```bash
sudo ./apply_overlay.sh pin7_overlay.dts
```

---

## 📂 Sample Device Tree Source Files

### 📄 [`pin7_overlay.dts`](./pin7_overlay.dts)

This overlay is used to configure **40-pin header Pin 7** (`SOC_GPIO33`) as a bidirectional GPIO with an internal pull-up. It is used in this project to connect a **limit switch on the azimuth servo**.

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

---

## 📌 Related Documentation

* [Jetson Linux Developer Guide - Configuring Expansion Headers](https://docs.nvidia.com/jetson/archives/r36.4.4/DeveloperGuide/HR/ConfiguringTheJetsonExpansionHeaders.html)
* [JetsonHacks: Device Tree Overlays on Jetson](https://jetsonhacks.com/2025/04/07/device-tree-overlays-on-jetson-scary-but-fun/)
* [`system_setup.md`](../../system_setup.md) – for a full breakdown of GPIO configuration process

---

## 🛡️ Best Practices

* Always reboot after applying a new overlay
* Use a version-controlled `.dts` file for reproducibility
* Back up your original boot config (`extlinux.conf`) before applying changes
* Verify overlay has loaded with:

  ```bash
  sudo cat /proc/device-tree/overlays/
  ```
