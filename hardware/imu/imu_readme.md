# WT901C-TTL IMU — Dish Orientation, Headings & API

This repository contains:

- `hardware/imu/wt901c.py` — WT901C binary driver with **dish mounting**, **tilt-compensated magnetic & true heading**, **cross-level**, **elevation**, **declination hooks**, and **reference offsets**.
- `hardware/imu/wt901c_api.py` — FastAPI service that exposes raw sensor packets **and** a computed **orientation** object via HTTP/WebSocket/SSE.

> **TL;DR**: Steady, tilt-compensated headings that match your **dish azimuth**, plus cross-level and elevation aligned to your mechanics, available from both the Python library and a REST/SSE/WS API.

---

## Contents

- [Coordinate Frames & Mounting](#coordinate-frames--mounting)
- [Computed Orientation & Sign Conventions](#computed-orientation--sign-conventions)
- [Declination (Manual & via GPS)](#declination-manual--via-gps)
- [Reference Heading Offset](#reference-heading-offset)
- [Python Library Usage](#python-library-usage)
- [HTTP API Usage](#http-api-usage)
- [Examples (curl & Python)](#examples-curl--python)
- [Performance & Latency Tips](#performance--latency-tips)
- [Calibration Checklist](#calibration-checklist)
- [Troubleshooting](#troubleshooting)
- [Change Notes](#change-notes)

---

## Coordinate Frames & Mounting

**Sensor axes** (WT901C silkscreen):

- **Xₛ** → to the **right**
- **Yₛ** → **up/down** (varies with elevation)
- **Zₛ** → along the **boresight** (out of dish toward satellite)

**Dish body axes** (the control frame we compute in):

- **Forward (X_b)** = boresight
- **Right (Y_b)** = dish’s right
- **Up (Z_b)** = up

**Mapping baked into the library (Sensor → Body):**

    X_b (forward) =  Zₛ
    Y_b (right)   =  Xₛ
    Z_b (up)      =  Yₛ

Matrix form (Sensor→Body):

    R_mount = [[0,0,1],
               [1,0,0],
               [0,1,0]]

If you re-mount the IMU, you can replace the matrix:

    imu.set_mount_matrix(((0,0,1),(1,0,0),(0,1,0)))

---

## Computed Orientation & Sign Conventions

The driver derives roll/pitch from **accelerometer in the body frame**, then **tilt-compensates** the magnetometer to compute heading.

- **heading_mag_deg** — 0…360°, **clockwise** from magnetic north, after your **reference offset** is applied.
- **heading_true_deg** — `heading_mag_deg + declination_deg` (wrapped to 0…360).
- **cross_level_deg** — **roll about boresight (X_b)**; ~0° when cross-level centered (mechanical range ≈ ±10°).
- **elevation_deg** — **pitch about right axis (Y_b)**; **positive up** (mechanical range ≈ −59°…+59°).

**Why tilt compensation?**  
Elevation and cross-level tilts are removed using gravity before heading is computed, so only **azimuth** rotation moves the heading.

---

## Declination (Manual & via GPS)

Declination converts magnetic → **true** heading and varies with location/time.

- **Manual** (simple, no extra dependencies):

    imu.set_declination_deg(3.5)  # Berlin example; east is positive

- **GPS-driven** (optional): Register a provider function that returns declination (deg, east +) from `(lat, lon, alt_m, time)` using a geomagnetic model (e.g., WMM/IGRF).  
  The library **does not bundle** a model; this keeps the project lean.

    imu.set_declination_provider(my_declination_fn)                 # register once
    imu.update_declination_from_gps(lat, lon, alt_m, gps_datetime)  # call on each GPS fix

API orientation fields include provenance:

    {
      "declination_deg": 3.5,
      "declination_source": "manual|auto",
      "declination_timestamp_utc": "2025-10-22T16:41:00Z"
    }

> If no provider is set, the GPS update is a **no-op** and the last manual value is used.

---

## Reference Heading Offset

To make your *current pose* read ~0° (e.g., dish approximately North), set a **heading offset**:

1) Point the dish at your reference pose.  
2) Read `heading_mag_deg`.  
3) Compute `offset = -heading_mag_deg` (wrap to 0..360) and set:

    imu.set_heading_offset_deg(23.58)  # example from session

The offset is applied **before** declination.

---

## Python Library Usage

Install dependencies:

    pip install pyserial fastapi uvicorn

Minimal code:

    from hardware.imu.wt901c import WT901C, PID

    imu = WT901C("/dev/imu", baud=9600).start()

    # Optional: manual declination
    imu.set_declination_deg(3.5)

    # Optional: reference offset so current pose ~ 0°
    imu.set_heading_offset_deg(23.58)

    # Optional: GPS-driven declination (requires your provider function)
    # imu.set_declination_provider(my_declination_fn)
    # imu.update_declination_from_gps(lat, lon, alt_m, gps_time)

    # Get computed orientation (requires ACC + MAG packets to have arrived)
    o = imu.get_orientation()
    if o:
        print("Mag:", o.heading_mag_deg,
              "True:", o.heading_true_deg,
              "Xlvl:", o.cross_level_deg,
              "Elev:", o.elevation_deg)

    # Raw last-packet access remains
    acc = imu.last(PID.ACC)
    mag = imu.last(PID.MAG)

`Orientation` as JSON:

    {
      "heading_mag_deg": 12.34,
      "heading_true_deg": 15.84,
      "cross_level_deg": 0.42,
      "elevation_deg": 30.71,
      "declination_deg": 3.5,
      "declination_source": "manual",
      "declination_timestamp_utc": "2025-10-22T16:41:00Z",
      "heading_offset_deg": 23.58
    }

---

## HTTP API Usage

Start the server:

    IMU_PORT=/dev/imu IMU_BAUD=9600 python -m back_end.hardware.imu.wt901c_api --host 0.0.0.0 --port 8080

Key endpoints:

- **Computed orientation**
    - `GET /orientation`
    - `GET /last/orientation`
    - `GET /sse?types=orientation` (SSE stream)

- **Declination & Offset**
    - `POST /orientation/declination/{deg}` — set manual declination
    - `POST /orientation/declination/gps` — update from GPS fix (uses provider hook)
    - `POST /orientation/offset/{deg}` — set heading offset

- **Raw data**
    - `GET /snapshot?types=acc,mag,ang,orientation`
    - `GET /last/{name}` for `acc|gyro|ang|mag|baro|quat|gps|gps2|dport|orientation`
    - `GET /sse?types=acc,mag,orientation`
    - `WS /ws` for continuous JSON stream

- **Config & Calibration**
    - `POST /config/rate/{hz}` (1–200)
    - `POST /config/content/{mask}`
    - `POST /calib/accel/{start|stop}`
    - `POST /calib/mag/{start|stop}`
    - `POST /calib/full?mag=true&duration=20`
    - `POST /config/advanced` (unlock→set→save→lock convenience)

Open Swagger UI:

    xdg-open http://localhost:8080/docs

---

## Examples (curl & Python)

Live orientation via SSE:

    curl -N http://localhost:8080/sse?types=orientation

One orientation sample:

    curl http://localhost:8080/orientation | jq

Set manual declination to +3.5°:

    curl -X POST http://localhost:8080/orientation/declination/3.5

Apply your captured offset (+23.58°):

    curl -X POST http://localhost:8080/orientation/offset/23.58

Update declination from a GPS fix  
*(safe no-op if no provider set; returns current declination state)*:

    curl -X POST http://localhost:8080/orientation/declination/gps \
      -H "Content-Type: application/json" \
      -d '{"lat":52.52, "lon":13.405, "alt_m":45, "timestamp_iso":"2025-10-22T12:00:00Z"}'

Minimal Python SSE listener:

    import requests
    with requests.get("http://localhost:8080/sse?types=orientation", stream=True) as r:
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data: "):
                print(line[6:])

---

## Performance & Latency Tips

- **Baud rate**: Prefer **115200** (9600 works but limits throughput).
- **Serial timeout**: Keep short (`timeout≈0.01`) to reduce blocking latency.
- **Terminal printing**: Throttle flush to ~20 Hz for smooth UI.
- **Content mask**: Enable only what you need (e.g., ACC + MAG) for higher effective rate.

---

## Calibration Checklist

1) **Accelerometer** — device still, level surface.  
2) **Magnetometer (on the dish)** — figure-8s and sweep az/el poses; calibrate in the **installed** environment.  
3) **Reference Offset** — point to reference North; set offset = `-heading_mag` (wrap 0..360).  
4) **Declination** — set manual value or wire GPS→provider for auto updates.

> Recalibrate magnetometer after mechanical changes or if moved to a different magnetic environment (reflector/motors/cabling can introduce soft/hard-iron effects).

---

## Troubleshooting

- **No orientation yet** → Ensure **ACC** and **MAG** packets are enabled and arriving.
- **Heading shifts with elevation** → Tilt compensation needs valid accel; verify ACC stream & calibration.
- **True heading has constant bias** → Adjust **declination** or **reference offset**.
- **Jitter under fast motion** → High dynamics corrupt accel tilt; consider fusing with gyro/yaw (future enhancement).
- **Cross-level / Elevation swapped** → Verify mounting; if re-mounted, update `set_mount_matrix()`.

---

## Change Notes

**v1.1.0**

- Driver: Added `get_orientation()` / `orientation_json()` with tilt-compensated headings, cross-level, elevation.
- Baked-in dish mounting (Sensor→Body) and declination management (manual + GPS provider hook).
- Added reference heading offset.
- API: Publishes `orientation` via `/orientation`, `/last/orientation`, SSE/WS.
- New endpoints to set **declination** and **offset**.
- Documentation for dish mechanics: cross-level ≈ ±10°, elevation ≈ −59°…+59°.

---

### Notes

- Device: **WitMotion WT901C-TTL** (binary protocol `0x55`).
- Scales match common WT901 firmwares; adjust `SCALE_*` if yours differs.
- Declination model/provider is **not bundled**; add one when needed (keeps project lean).
