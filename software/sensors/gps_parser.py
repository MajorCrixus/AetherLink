"""
GPS Parser for Holybro M9N GNSS
Parses NMEA data for location, heading, and time.
"""

import serial
import pynmea2

class M9NGPS:
    def __init__(self, port="/dev/ttyUSB0", baudrate=9600, timeout=1.0):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.ser = None

    def connect(self):
        try:
            self.ser = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=self.timeout
            )
            print(f"✅ GPS connected on {self.port}")
        except serial.SerialException as e:
            print(f"❌ Failed to connect to GPS: {e}")
            self.ser = None

    def read_sentence(self):
        if not self.ser:
            return None
        try:
            line = self.ser.readline().decode('ascii', errors='ignore').strip()
            return line
        except Exception as e:
            print(f"❌ GPS read error: {e}")
            return None

    def get_data(self):
        sentence = self.read_sentence()
        if not sentence or not sentence.startswith("$"):
            return None
        try:
            msg = pynmea2.parse(sentence)
            if isinstance(msg, pynmea2.types.talker.GGA):
                return {
                    "lat": msg.latitude,
                    "lon": msg.longitude,
                    "altitude_m": msg.altitude,
                    "time_utc": str(msg.timestamp)
                }
            elif isinstance(msg, pynmea2.types.talker.HDT):
                return {"heading_deg": float(msg.heading)}
        except pynmea2.nmea.ChecksumError:
            pass
        except Exception as e:
            print(f"❌ Parse error: {e}")
        return None

    def disconnect(self):
        if self.ser:
            self.ser.close()
            print("🔌 GPS disconnected.")

# Test loop
if __name__ == "__main__":
    gps = M9NGPS()
    gps.connect()
    try:
        while True:
            data = gps.get_data()
            if data:
                print(f"📍 GPS: {data}")
    except KeyboardInterrupt:
        gps.disconnect()
