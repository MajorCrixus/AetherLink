#!/usr/bin/env python3
"""
🧪 Power Diagnostics for Jetson AGX Orin
Continuously monitors system power usage using `tegrastats`.
Outputs CPU, GPU, and RAM metrics with optional CSV logging.
"""

import subprocess
import re
import time
import argparse
import csv
from datetime import datetime

def parse_tegrastats(output_line):
    """
    Parse a line of tegrastats output.
    Returns a dictionary with timestamp, CPU load, GPU load, and RAM usage.
    """
    match = re.search(r'RAM (\d+\/\d+MB) .*?CPU \[(.*?)\] GPU (\d+)%', output_line)
    if not match:
        return None
    return {
        'timestamp': datetime.now().isoformat(),
        'ram_usage': match.group(1),
        'cpu_load': match.group(2),
        'gpu_load': match.group(3)
    }

def run_monitor(interval, duration, log_path=None):
    """
    Main loop to launch `tegrastats`, collect power metrics, and optionally log to CSV.
    """
    print(f"🟢 Starting tegrastats power monitoring for {duration}s at {interval}s intervals...")
    start_time = time.time()
    data_log = []

    try:
        # Launch tegrastats in subprocess
        proc = subprocess.Popen(['tegrastats'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        while time.time() - start_time < duration:
            output_line = proc.stdout.readline()
            if output_line:
                data = parse_tegrastats(output_line)
                if data:
                    data_log.append(data)
                    print(f"[{data['timestamp']}] CPU: {data['cpu_load']} | GPU: {data['gpu_load']}% | RAM: {data['ram_usage']}")
            time.sleep(interval)

    except KeyboardInterrupt:
        print("🛑 Monitoring interrupted by user.")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        proc.terminate()
        if log_path:
            try:
                print(f"💾 Writing power log to {log_path}...")
                with open(log_path, 'w', newline='') as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=['timestamp', 'ram_usage', 'cpu_load', 'gpu_load'])
                    writer.writeheader()
                    writer.writerows(data_log)
                print("✅ Log saved successfully.")
            except Exception as e:
                print(f"❌ Failed to write log file: {e}")
        print("✅ Power diagnostics completed.\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monitor Jetson system power usage using tegrastats.")
    parser.add_argument('--interval', type=int, default=2, help='Polling interval in seconds (default: 2)')
    parser.add_argument('--duration', type=int, default=60, help='Total runtime in seconds (default: 60)')
    parser.add_argument('--log', type=str, help='Optional CSV file to write output logs')
    args = parser.parse_args()

    run_monitor(args.interval, args.duration, args.log)
