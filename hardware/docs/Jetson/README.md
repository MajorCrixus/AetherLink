## 40-pin header assignment
<p>
        <img alt="" src="https://developer.download.nvidia.com/embedded/images/jetsonAgxOrin/getting_started/jao_cbspec_figure_3-4_white-bg.png#only-light">
        <img alt="" src="https://developer.download.nvidia.com/embedded/images/jetsonAgxOrin/getting_started/jao_cbspec_figure_3-4_black-bg.png#only-dark">  
</p>

## Low-Level Hardware & OS Verification
### Jetson Model
```
cat /proc/device-tree/model
```
<p data-start="427" data-end="498">→ Return: <code data-start="459" data-end="497">NVIDIA Jetson AGX Orin Developer Kit</code></p>



### L4T & JetPack Version
```
head -n 1 /etc/nv_tegra_release
```
<p data-start="427" data-end="498">→ Return: <code data-start="617" data-end="649"># R36 (release), REVISION: 4.4, GCID: 41062509, BOARD: generic, EABI: aarch64, DATE: Mon Jun 16 16:07:13 UTC 2025</code></p>



### GPIO chip visibility
```
ls /dev/gpiochip*
```
<p data-start="427" data-end="498">→ Return: <code data-start="617" data-end="649">/dev/gpiochip0  /dev/gpiochip1  /dev/gpiochip2</code></p>

```
gpiodetect
```
<p data-start="427" data-end="498">→ Return: <code data-start="617" data-end="649">
gpiochip0 [tegra234-gpio] (164 lines)
gpiochip1 [tegra234-gpio-aon] (32 lines)
gpiochip2 [ftdi-cbus] (4 lines)</code></p>


## Install Jetson.GPIO
### Create a Virtual Environment
<p><strong>Navigate to your project directory</strong> (or create a new one):</p>

```
cd /path/to/your/project
```
<p><strong>Create the virtual environment</strong> by running:</p>

```
python3 -m venv venv
```
<p>NOTE: This command creates a directory named <code class="qlv4I7skMF6Meluz0u8c wZ4JdaHxSAhGy1HoNVja _dJ357tkKXSh_Sup5xdW">venv</code> in your project folder, containing the virtual environment.</p>

<p>To activate the virtual environment, use the following command:</p>

```
source venv/bin/activate
```

<p>NOTE: After activation, your terminal prompt will change to indicate that you are now working within the virtual environment.</p>

### Install Jetson.GPIO (NVIDIA’s Package)
```
sudo pip3 install Jetson.GPIO
```
Verify:
```
python3 -c "import Jetson.GPIO as GPIO; print(GPIO.VERSION)"
```

### Final Steps
<p data-start="1033" data-end="1072"><strong data-start="1033" data-end="1071">Confirm you’re in the <code data-start="1057" data-end="1063">gpio</code> group</strong>:</p>

```
groups
```
<p>NOTE: If you do not see gpio listed then using the following two commands to add user permissions</p>

<p data-start="1096" data-end="1118"><strong data-start="1096" data-end="1117">(If not yet done)</strong>:</p>

```
sudo groupadd -f -r gpio
```
```
sudo usermod -a -G gpio $USER
```

<p data-start="1190" data-end="1210"><strong data-start="1190" data-end="1209">Copy udev rules</strong>:</p>

```
sudo cp /usr/local/lib/python3.10/dist-packages/Jetson/GPIO/99-gpio.rules /etc/udev/rules.d/
```
```
sudo udevadm control --reload-rules && sudo udevadm trigger
```

<p data-start="1380" data-end="1391"><strong data-start="1380" data-end="1390">Reboot</strong>:</p>

```
sudo reboot
```
