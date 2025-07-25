# Holybro M9N GPS Module

## Overview

<figure><img src="https://2367252986-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FLIgtGDAvVGkCKGOJb1bR%2Fuploads%2FzqadAr9GEegq1le5IxVe%2FM10-M9N-M8N.jpg?alt=media&#x26;token=d571f3f5-1cac-4019-bb4a-b3f37124c98a" alt=""><figcaption></figcaption></figure>

### Overview <a href="#descriptions" id="descriptions"></a>

These GPS uses multi-constellation GNSS powered by u-blox M10, M9N, and M8N series, a concurrent GNSS receiver that can receive and track multiple GNSS systems. Owing to the multi-band RF front-end architecture, all four major GNSS constellations, GPS, Galileo, GLONASS, and BeiDou, can be received concurrently.\
\
It also comes with the IST8310 compass, tricolored LED indicator, buzzer, and a safety switch.  The high-gain 25 x 25 mm2 patch antenna provides excellent performance, and the omnidirectional antenna radiation pattern increases flexibility for device installation.\
\
There are 3 different connector options for different purposes. Please Pinout page for more details.

{% hint style="info" %}
M10 and M9N GPS modules now come with an IP67 rating.
{% endhint %}

{% hint style="warning" %}
**Firmware Support for M10 GPS:** PX4 1.14, ArduPilot 4.3, INAV 5.0.0, Betaflight 4.3.0 or newer is required.
{% endhint %}

### Specification

<table data-full-width="false"><thead><tr><th width="255.87557603686633"></th><th width="269">Holybro M10 GPS</th><th width="268">Holybro M9N GPS</th></tr></thead><tbody><tr><td><strong>GNSS Receiver</strong></td><td>Ublox M10</td><td>Ublox M9N</td></tr><tr><td><strong>Number of Concurrent GNSS</strong></td><td>Up to 4 GNSS<br>- BeiDou<br>- Galileo<br>- GLONASS<br>- GPS<br>- QZSS</td><td>Up to 4 GNSS<br>- BeiDou<br>- Galileo<br>- GLONASS<br>- GPS<br>- QZSS</td></tr><tr><td><strong>Frequency Band</strong></td><td>- GPS L1<br>- Galileo E1<br>- GLONASS L1<br>- BeiDou B1<br>- SBAS L1<br>- QZSS L1</td><td>- GPS L1<br>- Galileo E1<br>- GLONASS L1<br>- BeiDou B1<br>- SBAS L1<br>- QZSS L1</td></tr><tr><td><strong>Compass</strong></td><td>IST8310</td><td>IST8310</td></tr><tr><td><strong>Output Protocol</strong></td><td>- UBX (U-blox)<br>- NMEA</td><td>- UBX (U-blox)<br>- NMEA</td></tr><tr><td><strong>Accuracy</strong></td><td>2.0m CEP</td><td>1.5m CEP</td></tr><tr><td><strong>Nav. Update Rate</strong> </td><td>Up to 25 Hz (single GNSS),<br>Up to 10 Hz (4 concurrent GNSS)</td><td>Up to 25 Hz (4 concerrent GNSS)</td></tr><tr><td><strong>GNSS Augmentation System</strong></td><td>EGNOS, GAGAN, MSAS and WAAS<br>QZSS: L1S</td><td>EGNOS, GAGAN, MSAS and WAAS<br>QZSS: L1S </td></tr><tr><td><strong>Default Baud Rate</strong></td><td>115200</td><td>115200</td></tr><tr><td><strong>Input Voltage</strong> </td><td>4.7-5.2V</td><td>4.7-5.2V</td></tr><tr><td><strong>Port Type</strong></td><td>JST-GH-10P</td><td>JST-GH-10P</td></tr><tr><td><strong>Antenna</strong></td><td>25 x 25 x 4 mm ceramic patch antenna</td><td>25 x 25 x 4 mm ceramic patch antenna</td></tr><tr><td><strong>Power consumption</strong></td><td>Less than 200mA @ 5V</td><td>Less than 200mA @ 5V</td></tr><tr><td>Water Resistance Rating</td><td>IP67</td><td>IP67</td></tr><tr><td><strong>Operating Temperature</strong></td><td>-40~80C</td><td>-40~80C</td></tr><tr><td><strong>Dimension</strong></td><td>φ50 x14.4 mm</td><td>φ50 x14.4 mm</td></tr><tr><td><strong>Weight</strong></td><td>32g </td><td>32g </td></tr><tr><td><strong>Cable Length</strong></td><td>26cm (42cm cable purchase separately)</td><td>26cm (42cm cable purchase separately)</td></tr><tr><td><strong>Other</strong></td><td>- Tri-color LED<br>- Onboard Buzzer<br>- Safety Switch<br>- LNA MAX2659ELT+ RF Amplifier<br>- Rechargeable Farah capacitance<br>- Low noise 3.3V regulator</td><td>- Tri-color LED<br>- Onboard Buzzer<br>- Safety Switch<br>- LNA MAX2659ELT+ RF Amplifier<br>- Rechargeable Farah capacitance<br>- Low noise 3.3V regulator</td></tr></tbody></table>

* **M8N:** Concurrent reception of up to 3 GNSS (GPS, Galileo, GLONASS, BeiDou)
