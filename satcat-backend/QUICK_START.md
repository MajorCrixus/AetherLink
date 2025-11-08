# Quick Start Guide

Get the AetherLink Satellite Catalog Backend running in 5 minutes.

## Prerequisites

1. **Node.js 20+** installed
2. **PostgreSQL 14+** running locally
3. **Space-Track.org account** (free - register at https://www.space-track.org/auth/createAccount)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd /home/major/aetherlink/satcat-backend
npm install
```

### 2. Create PostgreSQL Database

```bash
# Create database
sudo -u postgres createdb satcat_db

# Create user (optional - if you want a dedicated user)
sudo -u postgres psql -c "CREATE USER satcat_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE satcat_db TO satcat_user;"
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

**Minimum required settings:**
```env
POSTGRES_URL=postgres://postgres:your_postgres_password@localhost:5432/satcat_db
SPACETRACK_USERNAME=your_email@example.com
SPACETRACK_PASSWORD=your_spacetrack_password
```

### 4. Initialize Database Schema

```bash
npm run db:push
```

This creates all tables, indexes, and triggers.

### 5. Run Initial Data Ingest

```bash
# Test with small dataset (100 satellites)
npm run ingest -- --limit 100
```

This will:
- Login to Space-Track.org
- Fetch 100 SATCAT entries
- Fetch latest TLEs for those satellites
- Fetch transmitter data from SatNOGS
- Auto-tag satellites based on transmitter data

**Expected output:**
```
============================================================
AetherLink Satellite Catalog - Data Ingest
============================================================
Mode: DELTA/INCREMENTAL
============================================================

[Ingest] Starting Space-Track ingest...
[SpaceTrack] Logging in as your_email@example.com...
[SpaceTrack] Login successful
[SpaceTrack Ingest] Fetched 100 SATCAT entries
[SpaceTrack Ingest] Fetched 100 TLE entries

[Ingest] Space-Track Results:
  Satellites inserted: 100
  Satellites updated:  0
  TLEs inserted:       100

[Ingest] Starting SatNOGS ingest...
[SatNOGS Ingest] Fetched 250 transmitters
[SatNOGS Ingest] Auto-tagged 45 satellites

[Ingest] SatNOGS Results:
  Transmitters inserted: 250
  Transmitters updated:  0
  Transmitters skipped:  0

============================================================
[Ingest] Complete!
============================================================
```

### 6. Start API Server

```bash
npm run dev
```

**Expected output:**
```
============================================================
AetherLink Satellite Catalog Backend
============================================================
[Server] Connecting to database...
[Database] Connected to PostgreSQL
[Server] Database health check: OK
============================================================
[Server] Listening on http://0.0.0.0:9001
[Server] API endpoints:
  - Health:     http://0.0.0.0:9001/api/health
  - Stats:      http://0.0.0.0:9001/api/stats
  - Satellites: http://0.0.0.0:9001/api/satellites
============================================================
```

### 7. Test API

Open a new terminal and test:

```bash
# Health check
curl http://localhost:9001/api/health

# Database stats
curl http://localhost:9001/api/stats

# Query LEO satellites
curl "http://localhost:9001/api/satellites?orbit=LEO&limit=10"

# Get ISS details
curl http://localhost:9001/api/satellites/25544
```

## Common Issues

### Issue: "ECONNREFUSED" database error

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL if needed
sudo systemctl start postgresql

# Verify database exists
sudo -u postgres psql -l | grep satcat_db
```

### Issue: "Login failed" Space-Track error

**Solutions:**
1. Verify credentials at https://www.space-track.org
2. Check `.env` file has correct `SPACETRACK_USERNAME` and `SPACETRACK_PASSWORD`
3. Make sure you're using your Space-Track **account email**, not username

### Issue: "Rate limited (429)" error

**This is normal!** The client automatically retries with backoff. If it persists:
```bash
# Increase delay in .env
SPACETRACK_MIN_INTERVAL_MS=2000
```

### Issue: Raspberry Pi runs out of memory during ingest

**Solution:** Limit the dataset size:
```bash
npm run ingest -- --limit 500
```

## Next Steps

### Run Full Ingest (Optional)

Once you've verified everything works:

```bash
# Ingest more satellites (recommended: start with 1000)
npm run ingest -- --limit 1000

# Or run full ingest (takes ~15-20 minutes)
npm run ingest -- --full
```

### Set Up Daily Auto-Ingest

```bash
# Add to crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /home/major/aetherlink/satcat-backend && npm run ingest >> /var/log/satcat-ingest.log 2>&1
```

### Integrate with Frontend

The Python backend proxy should forward requests to this service:

```python
# In webapp/backend/main.py or similar
app.mount("/api/satellites",
    proxy_pass="http://localhost:9001/api")
```

Or configure the frontend to call this API directly:

```typescript
// In webapp/frontend/src/services/satelliteApi.ts
const API_BASE = 'http://localhost:9001/api';

export async function fetchSatellites(params: QueryParams) {
  const response = await fetch(`${API_BASE}/satellites?${new URLSearchParams(params)}`);
  return response.json();
}
```

## Monitoring

### View Database

```bash
npm run db:studio
```

Opens Prisma Studio at http://localhost:5555

### Check Logs

```bash
# View server logs (if running with npm start)
tail -f /var/log/satcat-backend.log

# View ingest logs (if using cron)
tail -f /var/log/satcat-ingest.log
```

### Query Database Directly

```bash
sudo -u postgres psql satcat_db

-- Check satellite count
SELECT COUNT(*) FROM satellite;

-- Check TLE count
SELECT COUNT(*) FROM tle;

-- Check last ingest time
SELECT * FROM ingest_state;
```

## Production Deployment

For production use:

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name satcat-backend
   pm2 startup  # Enable auto-start on boot
   pm2 save
   ```

3. **Set up reverse proxy (optional):**
   ```nginx
   # In /etc/nginx/sites-available/aetherlink
   location /api/satellites {
       proxy_pass http://localhost:9001/api;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```

## Support

For detailed documentation, see [README.md](README.md)

For issues:
- Check logs: `npm run dev` shows detailed error messages
- Database issues: `npm run db:studio` to inspect data
- API issues: Test with `curl` to isolate frontend/backend problems
