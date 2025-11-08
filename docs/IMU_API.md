mkdir -p ~/Desktop/aetherlink/back_end/hardware/imu
cat > ~/Desktop/aetherlink/back_end/hardware/imu/IMU_API.md << 'EOF_IMUAPI'
# WT901C-TTL IMU API (FastAPI)

This service exposes live telemetry and configuration for the **WitMotion WT901C-TTL** IMU over HTTP (REST), **SSE** (server-sent events), and **WebSocket**.

- Driver: `back_end/hardware/imu/wt901c.py`  
- API server: `back_end/hardware/imu/wt901c_api.py`
- Verified device settings in this project:
  - **Port**: `/dev/ttyUSB1` (CH340, VID:PID 1A86:7523)
  - **Baud**: **9600** bps (binary 0x55 stream)
  - **Active PIDs** seen: ACC (0x51), GYRO (0x52), ANG (0x53), MAG (0x54), QUAT (0x59)  
    *(BARO often zero on some units)*

> **Note**  
> Some firmware reports an odd `temp_c` inside ANG (0x53). Prefer ACC/GYRO temps; our API can hide `ang.temp_c`.

---

## 1) Requirements

~~~bash
pip install fastapi uvicorn
~~~

Linux serial access:

~~~bash
# once
sudo usermod -a -G dialout $USER
# re-login or:
sudo setfacl -m u:$USER:rw /dev/ttyUSB1
~~~

Ensure the repo root is on `PYTHONPATH` (for package imports):

~~~bash
export PYTHONPATH="$(pwd)"
~~~

---

## 2) Starting the server

### Option A — run the module

~~~bash
cd ~/Desktop/aetherlink
export PYTHONPATH="$(pwd)"

# set your serial port and baud
IMU_PORT=/dev/ttyUSB1 IMU_BAUD=9600 \
python -m back_end.hardware.imu.wt901c_api --host 0.0.0.0 --port 8080
~~~

Open:

- http://127.0.0.1:8080/health  
- http://127.0.0.1:8080/docs (Swagger UI)

> If you bind with `--host '::'` (IPv6), use `http://[::1]:8080/health` or ensure `net.ipv6.bindv6only=0`.

### Option B — dev mode (hot reload) *(optional)*

Add this to `wt901c_api.py`:

~~~python
def app_factory():
    import os
    return create_app(
        port=os.environ.get("IMU_PORT", "/dev/ttyUSB0"),
        baud=int(os.environ.get("IMU_BAUD", "115200"))
    )
~~~

Then:

~~~bash
IMU_PORT=/dev/ttyUSB1 IMU_BAUD=9600 \
uvicorn back_end.hardware.imu.wt901c_api:app_factory --factory --host 0.0.0.0 --port 8080 --reload
~~~

---

## 3) Endpoint reference

### Health
~~~text
GET /health
→ 200 {"ok": true}
~~~

### Snapshot (pull, latest parsed packets)
~~~text
GET /snapshot?types=ang,acc,gyro,mag,quat,time,baro
→ 200 {"ts":{"mono":...}, "ang":{...}, "gyro":{...}, ...}
~~~
`types` = comma-separated list. Only included if a packet has been seen.

### Last (single type)
~~~text
GET /last/{name}   # name ∈ {ang,acc,gyro,mag,quat,baro,time}
→ 200 {...} or 404 if none yet
~~~

### Streaming (push)

**SSE**
~~~text
GET /sse?types=ang,gyro
→ text/event-stream
data: {"type":"ang","data":{...},"ts":...}
data: {"type":"gyro","data":{...},"ts":...}
event: ping
data: {}
~~~

**WebSocket**
~~~text
WS /ws
# server pushes {"type": "...", "data": {...}, "ts": ...}
~~~

### Configuration
~~~text
POST /config/rate/{hz}         # sets IMU output rate (Hz)
POST /config/baud/{code}       # 0:9600, 1:19200, 2:38400, 3:57600, 4:115200 (requires reopen)
POST /save                      # persist configuration on device
POST /reset                     # soft reset
POST /calib/accel/{start|stop}  # accel calibration
POST /calib/mag/{start|stop}    # mag calibration
~~~

**Optional (if enabled in your build):**
~~~text
GET  /debug/stats               # rates & ages per PID ({rates_fps, ages_s, uptime_s})
POST /config/content/{mask}     # bitmask to select output PIDs (FW-dependent)
~~~

Typical mask bits (may vary):  
`bit0=ACC, bit1=GYRO, bit2=ANG, bit3=MAG, bit4=BARO, bit5=QUAT`

Examples:
- `7`  (0b00000111): ACC+GYRO+ANG  
- `15` (0b00001111): ACC+GYRO+ANG+MAG

Persist after change:
~~~text
POST /save
~~~

---

## 4) Data formats (examples)

**ACC (0x51)**
~~~json
{
  "type": "acc",
  "data": { "ax_g": 0.08, "ay_g": 0.03, "az_g": -0.71, "temp_c": 24.95, "_pid": "acc" },
  "ts": 13337.50
}
~~~

**GYRO (0x52)**
~~~json
{ "type":"gyro","data":{"gx_dps":0.0,"gy_dps":0.0,"gz_dps":0.0,"temp_c":24.95,"_pid":"gyro"},"ts":... }
~~~

**ANG (0x53)** *(ANG temp may be hidden in API)*
~~~json
{ "type":"ang","data":{"roll_deg":177.79,"pitch_deg":-6.73,"yaw_deg":-0.94,"_pid":"ang"},"ts":... }
~~~

**MAG (0x54)**
~~~json
{ "type":"mag","data":{"mx":-1422,"my":-9035,"mz":9754,"temp_c":0.0,"_pid":"mag"},"ts":... }
~~~

**QUAT (0x59)**
~~~json
{ "type":"quat","data":{"q0":-0.019,"q1":-0.998,"q2":0.009,"q3":-0.058,"_pid":"quat"},"ts":... }
~~~

**BARO (0x56)** *(device dependent; often zeros)*
~~~json
{ "type":"baro","data":{"pressure_pa":0.0,"altitude_m":0.0,"_pid":"baro"},"ts":... }
~~~

---

## 5) Usage examples

### Curl (pull)
~~~bash
# health
curl http://127.0.0.1:8080/health

# narrow snapshot
curl "http://127.0.0.1:8080/snapshot?types=ang,gyro"

# set rate to 20 Hz
curl -X POST http://127.0.0.1:8080/config/rate/20

# save & reset
curl -X POST http://127.0.0.1:8080/save
curl -X POST http://127.0.0.1:8080/reset
~~~

### SSE (browser)
~~~html
<script>
const es = new EventSource("http://127.0.0.1:8080/sse?types=ang,acc,gyro");
es.onmessage = (e) => {
  const msg = JSON.parse(e.data); // {type, data, ts}
  if (msg.type === "ang") {
    const { roll_deg, pitch_deg, yaw_deg } = msg.data;
    // update UI...
  }
};
</script>
~~~

### WebSocket (browser)
~~~js
const ws = new WebSocket("ws://127.0.0.1:8080/ws");
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // msg.type ∈ {"ang","acc","gyro","mag","quat","baro","time"}
};
setInterval(() => ws.readyState === 1 && ws.send("ping"), 10000); // keep-alive
~~~

---

## 6) Bandwidth & rate planning (serial 9600 bps)

- 9600 bps ≈ **~960 bytes/s** (8N1).  
- Each packet = **11 bytes** → max **~87 frames/s** total.  
- Example safe config: **3 types × 20 Hz = 60 fps** (OK).  
- If enabling many types, lower `rate` accordingly.

---

## 7) Troubleshooting

**Only heartbeats on SSE (`event: ping`)**
- Wrong baud or device in ASCII mode.  
- Stop the API, auto-scan bauds to find frames (we used **9600**).  
- Make sure no other process has the port open:
  ~~~bash
  lsof -nP /dev/ttyUSB1
  sudo fuser -k /dev/ttyUSB1
  ~~~

**`Address already in use` on startup**
- Another server is on port 8080:
  ~~~bash
  fuser -k 8080/tcp
  ~~~
  Or start with `--port 8081`.

**Browser 404 on `/`**
- Add a root redirect in `create_app()`:
  ~~~python
  from fastapi.responses import RedirectResponse
  @app.get("/")
  def root():
      return RedirectResponse("/docs", status_code=307)
  ~~~

**IPv4 vs IPv6**
- Bound to `::`? Use `http://[::1]:8080/health` or bind `--host 0.0.0.0`.

**CORS**
- For external web UIs, restrict:
  ~~~python
  app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"], allow_headers=["*"]
  )
  ~~~

---

## 8) Notes for AetherLink

- Keep `PYTHONPATH` set to the repo root during dev.  
- Persist working device content (`/save`) after enabling packet types.  
- Consider a udev rule for a stable symlink:
  ~~~
  # /etc/udev/rules.d/99-imu.rules
  SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", SYMLINK+="imu"
  ~~~
  Then run with `IMU_PORT=/dev/imu`.

---

## 9) Changelog (project-local)

- 2025-10-11: Initial API docs; verified `/dev/ttyUSB1 @ 9600` and live ANG/ACC/GYRO/MAG/QUAT streaming. Added guidance on rate planning and optional debug/content endpoints.
EOF_IMUAPI
echo "✔ Wrote ~/Desktop/aetherlink/back_end/hardware/imu/IMU_API.md"
