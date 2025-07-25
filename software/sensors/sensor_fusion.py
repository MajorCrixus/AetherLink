"""
Sensor Fusion Module
Combines GPS + IMU to produce fused heading, pitch, and roll estimates
"""

from software.sensors.gps_parser import M9NGPS
from software.sensors.imu_parser import WT901Parser

class SensorFusion:
    def __init__(self, gps_port="/dev/ttyUSB0", imu_port="/dev/ttyUSB1"):
        self.gps = M9NGPS(port=gps_port)
        self.imu = WT901Parser(port=imu_port)

        self.heading = None
        self.pitch = None
        self.roll = None
        self.gps_lock = False

    def initialize(self):
        print("🧠 Initializing sensor fusion system...")
        self.gps.connect()
        self.imu.connect()

    def update(self):
        imu_data = self.imu.get_orientation()
        gps_data = self.gps.get_data()

        if imu_data:
            self.pitch = imu_data.get("pitch")
            self.roll = imu_data.get("roll")
            imu_heading = imu_data.get("yaw")

        if gps_data:
            gps_heading = gps_data.get("heading_deg")
            self.gps_lock = True

        # Choose GPS heading if available, otherwise fallback to IMU yaw
        if gps_data and "heading_deg" in gps_data:
            self.heading = gps_data["heading_deg"]
        elif imu_data:
            self.heading = imu_data.get("yaw")

    def get_status(self):
        return {
            "heading": self.heading,
            "pitch": self.pitch,
            "roll": self.roll,
            "gps_lock": self.gps_lock
        }

    def shutdown(self):
        self.gps.disconnect()
        self.imu.disconnect()
        print("🧠 Sensor fusion shutdown complete.")

# For direct testing
if __name__ == "__main__":
    fusion = SensorFusion()
    fusion.initialize()

    try:
        while True:
            fusion.update()
            print(f"🔎 Status: {fusion.get_status()}")
    except KeyboardInterrupt:
        fusion.shutdown()
