"""
SDR Box Scan Simulator (Stub)
Sweeps a small Az/El grid to identify signal peak.
"""

import random
import time

def perform_box_scan(center_az, center_el, range_deg=2.0, step_deg=0.2):
    results = []

    print(f"📡 Starting box scan at Az:{center_az}°, El:{center_el}°")
    az_steps = int(range_deg / step_deg)
    el_steps = int(range_deg / step_deg)

    for az_offset in range(-az_steps, az_steps + 1):
        for el_offset in range(-el_steps, el_steps + 1):
            az = center_az + az_offset * step_deg
            el = center_el + el_offset * step_deg
            signal_strength = simulate_signal_strength(az, el)
            results.append((az, el, signal_strength))
            print(f"  🔍 Az: {az:.1f}, El: {el:.1f} → Signal: {signal_strength:.2f}")
            time.sleep(0.05)  # Simulate SDR delay

    peak = max(results, key=lambda x: x[2])
    print(f"\n✅ Peak signal at Az: {peak[0]:.2f}, El: {peak[1]:.2f} (Signal: {peak[2]:.2f})")
    return peak

def simulate_signal_strength(az, el, target_az=180.0, target_el=45.0):
    # Simulated Gaussian signal peak
    noise = random.uniform(-1.0, 1.0)
    az_delta = (az - target_az) ** 2
    el_delta = (el - target_el) ** 2
    return max(0, 100 - (az_delta + el_delta) + noise)

if __name__ == "__main__":
    perform_box_scan(center_az=179.0, center_el=44.0)
