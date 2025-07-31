
## MKS SERVO57C V1.0 - Technical Documentation (Translated)

The MKS SERVO57C closed-loop <a href="https://so.csdn.net/so/search?q=%E6%AD%A5%E8%BF%9B%E7%94%B5%E6%9C%BA&amp;spm=1001.2101.3001.7020" target="_blank" class="hl hl-1" data-report-click="{&quot;spm&quot;:&quot;1001.2101.3001.7020&quot;,&quot;dest&quot;:&quot;https://so.csdn.net/so/search?q=%E6%AD%A5%E8%BF%9B%E7%94%B5%E6%9C%BA&amp;spm=1001.2101.3001.7020&quot;,&quot;extra&quot;:&quot;{\&quot;searchword\&quot;:\&quot;步进电机\&quot;}&quot;}" data-tit="步进电机" data-pretit="步进电机">stepper motor</a> is a product independently developed by the manufacturer base to meet market demand. With pulse interface and serial interface, built-in high-efficiency FOC vector algorithm, the use of high-precision encoder, through the position feedback, effectively prevent motor foot loss. Suitable for small robotic arms, 3D printers, engraving machines, writing machines and other automation products applications.</p>
<h3><a name="t2"></a><a id="12__4"></a>1.2 Product Features</h3>
<p>1. Supports four modes of operation: open-loop mode, closed-loop mode, <a href="https://so.csdn.net/so/search?q=FOC&amp;spm=1001.2101.3001.7020" target="_blank" class="hl hl-1" data-report-click="{&quot;spm&quot;:&quot;1001.2101.3001.7020&quot;,&quot;dest&quot;:&quot;https://so.csdn.net/so/search?q=FOC&amp;spm=1001.2101.3001.7020&quot;,&quot;extra&quot;:&quot;{\&quot;searchword\&quot;:\&quot;FOC\&quot;}&quot;}" data-tit="FOC" data-pretit="foc">FOC</a> mode, serial mode.
<br>2. Support pulse interface, the maximum input pulse frequency of 120KHz.
<br>3. Support USART interface (TTL) single-machine communication, from the machine address 256.
<br>4. Support RS-485 interface multi-machine communication, from the machine address 256.
<br>5. Maximum operating current 5.2A, MOSFET continuous operating current 46A.
<br>6. Built-in torque, velocity, position closed-loop control and FOC <a href="https://so.csdn.net/so/search?q=%E7%9F%A2%E9%87%8F&amp;spm=1001.2101.3001.7020" target="_blank" class="hl hl-1" data-report-click="{&quot;spm&quot;:&quot;1001.2101.3001.7020&quot;,&quot;dest&quot;:&quot;https://so.csdn.net/so/search?q=%E7%9F%A2%E9%87%8F&amp;spm=1001.2101.3001.7020&quot;,&quot;extra&quot;:&quot;{\&quot;searchword\&quot;:\&quot;矢量\&quot;}&quot;}" data-tit="矢量" data-pretit="矢量">vector</a> control algorithms.
<br>7. Supports 1~256 arbitrary subdivision, with internal interpolation function.
<br>8. Support common yang, co-yin signal and PLC 24V signal direct input.
<br>9. Quickly restore the factory configuration with one click.</p>
<h3><a name="t3"></a><a id="13__15"></a>1.3 Product parameters</h3>


### 🔧 Hardware Specifications

| Component             | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| MCU Master            | AT32F421 (Cortex-M4, 120MHz)                                   |
| MOSFET                | AP30H80Q (30V, 70A)                                            |
| Magnetic Encoder      | MT6816 (14-bit)                                                |
| RS485 Transceiver     | MAX13487E (±15kV ESD-protected)                                |
| Operating Voltage     | 12V–24V                                                        |
| Operating Current     | 0–5200 mA                                                      |
| Microstepping Support | Changliang                                                     |
| Feedback Frequency    | Torque Loop: 20 kHz, Speed Loop: 10 kHz, Position Loop: 10 kHz |
| Max Speed             | \~2000 RPM                                                     |
| Pulse Signal Input    | 3.3V–24V (Compatible)                                          |
| PLC Signal Input      | NPN/PNP 24V                                                    |
| Serial Signal Input   | Supports USART (TTL), RS-485                                   |
| Serial Baud Rate      | 9600 to 256000                                                 |
| Serial Addresses      | 1 broadcast, 255 device addresses                              |

---

### 🔲 Keypad Functions

* **Next** – Navigate options
* **Enter** – Confirm selection
* **Menu** – Enter/exit settings menu

**View Parameter Values:**

1. Press `Menu` →
2. Use `Next` to select option →
3. Press `Enter` to view current value

**Set Parameter Values:**

* Enter option → Use `Next` to scroll values → `Enter` to confirm

---

### 📀 Screen Parameters

* **Angle** – Displays rotation angle (including passive movement)
* **Error** – Displays motor position error
* **Pulse** – Displays received pulse count

---

### 📊 Physical Dimensions

Refer to original image diagram.
<a href="https://i-blog.csdnimg.cn/blog_migrate/52cba6cfa9030f6433f00da10fba6e92.png>

---

### 🧰 Wiring

#### 2.1 Pulse Control (MKS Gen\_L example)

| Pin # | SERVO57C Pin | Gen\_L Pin |
| ----- | ------------ | ---------- |
| 1     | V+           | VIN        |
| 2     | Gnd          | G          |
| 3     | Com          | VCC/GND/NC |
| 4     | En           | EN         |
| 5     | Stp          | STP        |
| 6     | Dir          | DIR        |

#### 2.2 PLC Control Wiring

| Pin # | SERVO57C Pin | PLC Board          |
| ----- | ------------ | ------------------ |
| 1     | V+           | 24V                |
| 2     | Gnd          | GND (0)            |
| 3     | Com          | NPN: 24V, PNP: GND |
| 4     | En           | Y0                 |
| 5     | Stp          | Y1                 |
| 6     | Dir          | Y2                 |

#### 2.3 TTL Serial

> **Note:** Only single-host communication is supported.

#### 2.4 RS-485

* **Single Device**
* **Multi-device Daisy Chain**

---

### 📃 Menu Descriptions

Full description of all menu options and corresponding values (CAL, Mode, Ma, MStep, En, Dir, Protect, MPlyer, UartBaud, UartAddr, 0\_Mode, Set 0, 0\_Speed, 0\_Dir, Restore, Exit).

---

### 📂 Serial Protocol

* Frame structure: Header (FA/FB), Address, Command, Data, CRC
* CRC = (sum of bytes) & 0xFF
* Address range: 00 (broadcast) to 255
* Default address: 01

---

### 📄 Command Reference

#### 5.1 Read Commands

* Encoder Value
* Input Pulse Count
* Position Error
* Enable Pin State
* Homing Status
* Clear Stall
* Read Stall Flag

#### 5.2 Set Commands

* Encoder Calibration
* Control Mode
* Current Setting
* Microstepping
* Enable Pin Level
* Motor Direction
* Stall Protection
* Interpolation
* Serial Baud Rate
* Address

#### 5.3 Restore Defaults

* Reset all settings and require calibration

#### 5.4 Motor Serial Control (CR\_UART Only)

* Enable/disable
* Set speed (direction + step)
* Stop
* Save/clear rotation
* Direct position control

---

### 🚧 Serial Monitor Settings

* Baud rate: 38400
* Data bits: 8
* Stop bits: 1
* Parity: None
* Mode: Hex
* CRC: Checksum 8-bit

---

### ❓ Troubleshooting

| Code | Problem               | Solution                        |
| ---- | --------------------- | ------------------------------- |
| 1    | Not Cal               | Motor not calibrated            |
| 2    | Reverse Lookup Error  | Calibration error               |
| 3    | Magnet Loss           | Magnet missing                  |
| 4    | Magnet Strong         | Magnet too close                |
| 5    | Magnet Weak           | Magnet too far                  |
| 6    | Encoder Error         | Encoder malfunction             |
| 7    | Offset Current Error  | Reference voltage error         |
| 8    | Phase Line Error      | Wrong motor wiring or low power |
| 9    | Wrong Protect         | Stall protection triggered      |
| 10   | Coming Back to Origin | Homing in progress              |
| 11   | Reboot Again          | Reboot required                 |

---

### 📞 After-Sales & Support

* **Bilibili:** [https://space.bilibili.com/393688975](https://space.bilibili.com/393688975)
* **Taobao Store:** [https://makerbase.taobao.com/](https://makerbase.taobao.com/)
* **QQ Group (Support):** 94866579
