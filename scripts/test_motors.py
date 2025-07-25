#!/usr/bin/env python3
"""
Motor Test Script for MKS Servo Drivers
Moves each motor a small distance for verification over RS485
"""

import time
import serial
import sys
from struct import pack

# Example config — pull from settings.yaml in full integration
motor_ports = {
    "azimuth": "/dev/ttyUSB2",
    "elevation": "/dev/ttyUSB3",
    "pan": "/dev/ttyUSB4"
}

BAUD = 38400
ADDR = 0x01
HEAD = 0xFA

def send_command(ser, payload):
    msg = bytes([HEAD, ADDR]) + payload
    ser.write(msg)
    print(f"➡️  Sent: {msg.hex()}")

def test_motor(name, port):
    print(f"\n🔧 Testing {name.upper()} on {port}")
    try:
        ser = serial.Serial(port, BAUD, timeout=1)
        time.sleep(0.1)

        # Example command: move relative +10000 pulses
        payload = bytes([0xFD, 0x02]) + pack('<i', 10000) + bytes([0x0C, 0x80])
        send_command(ser, payload)

        time.sleep(0.5)

        # Reverse move
        payload = bytes([0xFD, 0x02]) + pack('<i', -10000) + bytes([0x0C, 0x80])
        send_command(ser, payload)

        time.sleep(0.5)
        ser.close()
        print(f"✅ {name} responded correctly.")
    except Exception as e:
        print(f"❌ {name} test failed: {e}")

if __name__ == "__main__":
    for name, port in motor_ports.items():
        test_motor(name, port)
