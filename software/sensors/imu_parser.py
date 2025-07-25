"""
IMU Parser for WITmotion WT901C-TTL
Receives and parses 9-axis data (roll, pitch, yaw) over serial.
"""

import serial
import time

class WT901Parser:
    def __init__(self, port="/dev/ttyUSB1", baudrate=9600, timeout=1.0):
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
            print(f"✅ IMU connected on {self.port}")
        except serial.SerialException as e:
            print(f"❌ Failed to connect to IMU: {e}")
            self.ser = None

    def read_line(self):
        if not self.ser:
            print("❌ Serial port not open.")
            return None
        try:
            line = self.ser.readline().decode('utf-8', errors='ignore').strip()
            return line
        except Exception as e:
            print(f"❌ Error reading IMU: {e}")
            return None

    def parse_orientation(self, line):
        """
        Sample line (WITmotion custom format):
        $VNYMR,+12.3,+45.0,+89.4*XX

        Where:
        - +12.3 = Yaw
        - +45.0 = Pitch
        - +89.4 = Roll
        """
        if not line.startswith("$VNYMR"):
            return None
        try:
            parts = line.split(",")
            yaw = float(parts[1])
            pitch = float(parts[2])
            roll = float(parts[3].split("*")[0])  # Remove checksum
            return {"yaw": yaw, "pitch": pitch, "roll": roll}
        except Exception as e:
            print(f"❌ Parse error: {e}")
            return None

    def get_orientation(self):
        line = self.read_line()
        if line:
            return self.parse_orientation(line)
        return None

    def disconnect(self):
        if self.ser:
            self.ser.close()
            print("🔌 IMU disconnected.")

# For test runs
if __name__ == "__main__":
    imu = WT901Parser(port="/dev/ttyUSB1")
    imu.connect()

    try:
        while True:
            data = imu.get_orientation()
            if data:
                print(f"🧭 IMU: {data}")
            time.sleep(0.5)
    except KeyboardInterrupt:
        imu.disconnect()
