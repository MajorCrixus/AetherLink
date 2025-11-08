# AetherLink Satellite Catalog Backend

TypeScript/Node.js backend service that provides satellite tracking data for the AetherLink ground station control system.

## Features

- **Authoritative Satellite Data**: Pulls SATCAT and TLE data from [Space-Track.org](https://www.space-track.org)
- **RF/Transmitter Enrichment**: Augments with frequency/band data from [SatNOGS DB](https://db.satnogs.org)
- **Delta Updates**: Incremental ingest (only fetch new/changed data since last run)
- **Rate-Limited**: Respects Space-Track.org API terms of use
- **Cesium-Compatible**: REST API responses formatted for Cesium/Digital Arsenal integration
- **PostgreSQL Storage**: Normalized schema optimized for Raspberry Pi

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AetherLink System                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Cesium Frontend │────────▶│  Python Backend  │         │
│  │   (port 3001)    │         │   (port 9000)    │         │
│  │                  │         │  Hardware/Servos │         │
│  └────────┬─────────┘         └──────────────────┘         │
│           │                                                  │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │ TypeScript API   │                                       │
│  │  (port 9001)     │                                       │
│  │ Satellite Catalog│                                       │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │   PostgreSQL     │                                       │
│  │   Database       │                                       │
│  └──────────────────┘                                       │
│           ▲                                                  │
│           │                                                  │
│  ┌────────┴─────────────────────────────────┐              │
│  │                                            │              │
│  │  ┌───────────────┐    ┌────────────────┐ │              │
│  │  │ Space-Track   │    │  SatNOGS DB    │ │              │
│  │  │ (SATCAT, TLE) │    │ (Transmitters) │ │              │
│  │  └───────────────┘    └────────────────┘ │              │
│  │        External Data Sources              │              │
│  └───────────────────────────────────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Prerequisites

- **Node.js** 20+ (for TypeScript/ESM support)
- **PostgreSQL** 14+ (locally reachable)
- **Space-Track.org account** (free registration)

### 2. Install Dependencies

```bash
cd /home/major/aetherlink/satcat-backend
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env  # Fill in your credentials
```

**Required settings:**
- `POSTGRES_URL` - Your PostgreSQL connection string
- `SPACETRACK_USERNAME` - Your Space-Track.org email
- `SPACETRACK_PASSWORD` - Your Space-Track.org password

### 4. Initialize Database

```bash
# Create database (if it doesn't exist)
createdb satcat_db

# Apply schema
npm run db:push

# Or use migrations
npm run db:migrate
```

### 5. Run Initial Data Ingest

```bash
# Fetch satellite data (this will take a few minutes)
npm run ingest -- --full --limit 1000

# For a smaller test dataset:
npm run ingest -- --limit 100
```

### 6. Start Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The API will be available at: **http://localhost:9001**

## API Endpoints

### `GET /api/health`
Health check and database status

**Example:**
```bash
curl http://localhost:9001/api/health
```

### `GET /api/stats`
Database statistics (satellite count, TLE count, etc.)

**Example:**
```bash
curl http://localhost:9001/api/stats
```

### `GET /api/satellites`
Query satellites with filters

**Query Parameters:**
- `orbit` - Filter by orbit class: `LEO`, `MEO`, `HEO`, `GEO`
- `band` - Filter by frequency band: `VHF`, `UHF`, `S`, `X`, `Ku`, `Ka`
- `purpose` - Filter by purpose: `COMMUNICATIONS`, `IMAGERY`, `WEATHER`
- `owner` - Filter by owner/operator: `US`, `RUSSIA`, `CHINA`, etc.
- `limit` - Max results (default: 100)

**Examples:**
```bash
# All LEO satellites
curl "http://localhost:9001/api/satellites?orbit=LEO&limit=50"

# Ka-band satellites
curl "http://localhost:9001/api/satellites?band=Ka"

# US communications satellites
curl "http://localhost:9001/api/satellites?owner=US&purpose=COMMUNICATIONS"
```

**Response Format:**
```json
[
  {
    "id": "sat-25544",
    "norad_id": 25544,
    "name": "ISS (ZARYA)",
    "owner": "US",
    "orbit_class": "LEO",
    "launch_date": "1998-11-20T00:00:00Z",
    "object_type": "PAYLOAD",
    "bands": ["UHF", "S"],
    "purpose": ["COMMUNICATIONS"],
    "tle": {
      "line1": "1 25544U 98067A   ...",
      "line2": "2 25544  51.6461 ...",
      "epoch": "2025-11-02T12:34:56Z"
    }
  }
]
```

### `GET /api/satellites/:noradId`
Get detailed information for a specific satellite

**Example:**
```bash
curl http://localhost:9001/api/satellites/25544
```

**Response Format:**
```json
{
  "norad_id": 25544,
  "name": "ISS (ZARYA)",
  "intl_desig": "1998-067A",
  "owner": "US",
  "launch_date": "1998-11-20T00:00:00Z",
  "orbit": {
    "class": "LEO",
    "period_minutes": 92.68,
    "inclination_deg": 51.64,
    "apogee_km": 421,
    "perigee_km": 418
  },
  "tle": {
    "line1": "1 25544U 98067A   ...",
    "line2": "2 25544  51.6461 ...",
    "epoch": "2025-11-02T12:34:56Z"
  },
  "transmitters": [
    {
      "downlink_freq_mhz": 437.8,
      "downlink_band": "UHF",
      "mode": "FM",
      "status": "active"
    }
  ],
  "tags": {
    "PURPOSE": ["COMMUNICATIONS"],
    "BAND": ["UHF", "S"]
  },
  "actions": [
    {
      "label": "Exit Focus",
      "type": "ui"
    },
    {
      "label": "Acquire",
      "type": "task",
      "endpoint": "/api/acquire/25544"
    }
  ]
}
```

### `POST /api/acquire/:noradId`
Queue satellite acquisition (placeholder for antenna control)

**Example:**
```bash
curl -X POST http://localhost:9001/api/acquire/25544
```

## Data Ingest

The system supports two modes:

### Incremental/Delta Mode (Default)
Only fetches data updated since last run. Run this daily via cron.

```bash
npm run ingest
```

### Full Refresh Mode
Re-fetches all data (use sparingly to respect API limits).

```bash
npm run ingest -- --full
```

### Ingest Only Specific Sources

```bash
# Only Space-Track data
npm run ingest -- --spacetrack

# Only SatNOGS data
npm run ingest -- --satnogs
```

### Setting Up Daily Ingest (Cron)

```bash
crontab -e
```

Add this line to run at 2 AM daily:
```cron
0 2 * * * cd /home/major/aetherlink/satcat-backend && npm run ingest >> /var/log/satcat-ingest.log 2>&1
```

## Database Schema

```sql
satellite (id, norad_id*, name, owner, orbit_class, launch_date, ...)
  ├─ tle (id, norad_id, line1, line2, epoch, ...)
  ├─ transmitter (id, norad_id, freq_hz, band, mode, status, ...)
  └─ satellite_tag (id, norad_id, tag_type, tag_value, ...)

ingest_state (id, source*, last_successful_fetch_at, ...)
```

See [src/db/schema.sql](src/db/schema.sql) for full schema.

## Development

### Run Development Server
```bash
npm run dev
```

### Database Management
```bash
# View database in browser
npm run db:studio

# Generate Prisma client after schema changes
npm run db:generate

# Apply migrations
npm run db:migrate
```

### Testing API Endpoints
```bash
# Check health
curl http://localhost:9001/api/health

# Get stats
curl http://localhost:9001/api/stats

# Query satellites
curl "http://localhost:9001/api/satellites?orbit=LEO&limit=10"
```

## Rate Limiting

Space-Track.org terms of use:
- Max ~50 requests per minute
- Be respectful of their resources
- Use delta mode for daily updates (don't re-download everything)

The `RateLimitedClient` automatically:
- Enforces 1200ms minimum between requests (configurable)
- Handles HTTP 429 with exponential backoff
- Respects `Retry-After` headers

## Security

- **Never commit `.env`** - It contains credentials
- `.gitignore` already excludes `.env`
- Logs never print passwords/tokens (redacted in `rateLimit.ts`)
- Use environment variables for all secrets

## Cesium Integration

The API responses are formatted for Cesium/Digital Arsenal:

1. **TLE Format**: Client-side orbit propagation using SGP4
2. **Entity IDs**: Use `sat-{noradId}` format
3. **Timestamps**: ISO 8601 format
4. **Focus View**: Includes action buttons for UI integration

Example Cesium integration:
```typescript
// Fetch satellites
const response = await fetch('http://localhost:9001/api/satellites?orbit=LEO&limit=100');
const satellites = await response.json();

// Add to Cesium viewer
satellites.forEach(sat => {
  if (sat.tle) {
    // Use sat.tle.line1, sat.tle.line2 with SGP4 propagator
    // Position satellite at current time
  }
});
```

## Troubleshooting

### "Login failed" error
- Check `SPACETRACK_USERNAME` and `SPACETRACK_PASSWORD` in `.env`
- Verify account is active at https://www.space-track.org

### "Database connection failed"
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`
- Verify `POSTGRES_URL` in `.env`
- Create database if missing: `createdb satcat_db`

### "Rate limited (429)" errors
- This is normal - the client automatically retries
- If persistent, increase `SPACETRACK_MIN_INTERVAL_MS`

### Raspberry Pi performance issues
- Use `--limit` flag to fetch smaller datasets
- Run ingest during off-hours (cron at 2 AM)
- Consider increasing `SPACETRACK_MIN_INTERVAL_MS` to reduce load

## License

MIT License - See LICENSE file

## Credits

- **Space-Track.org** - Authoritative satellite catalog and TLE data
- **SatNOGS** - Open-source satellite ground station network and transmitter database
- **Cesium** - 3D geospatial visualization platform
- **Digital Arsenal** - Space domain awareness toolkit

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/aetherlink/issues
- Space-Track API Docs: https://www.space-track.org/documentation
- SatNOGS API Docs: https://docs.satnogs.org/projects/satnogs-db/en/latest/api.html
