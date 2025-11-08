/**
 * PostgreSQL Schema for Satellite Catalog Database
 *
 * Tables:
 * - satellite: Core satellite catalog (NORAD ID, name, owner, launch, orbit)
 * - tle: Two-Line Element sets for orbit propagation
 * - transmitter: RF transmitter data from SatNOGS (frequencies, bands, modes)
 * - satellite_tag: Classification tags (purpose, category, etc.)
 * - ingest_state: Tracks last successful data fetch for delta updates
 *
 * Design principles:
 * - Normalized schema to avoid data bloat on Raspberry Pi
 * - UPSERT-friendly (ON CONFLICT for incremental updates)
 * - Indexed for common query patterns (filtering by band, orbit, owner)
 * - Foreign keys with CASCADE for data integrity
 */

-- =============================================================================
-- 1. SATELLITE TABLE
-- =============================================================================
-- Core catalog information from Space-Track SATCAT

CREATE TABLE IF NOT EXISTS satellite (
    id SERIAL PRIMARY KEY,

    -- NORAD catalog ID (unique identifier across all sources)
    norad_id INTEGER UNIQUE NOT NULL,

    -- International designator (e.g., '1998-067A' for ISS)
    intl_desig TEXT,

    -- Satellite name
    name TEXT NOT NULL,

    -- Owner/operator (country or organization)
    owner TEXT,

    -- Launch date (YYYY-MM-DD)
    launch_date DATE,

    -- Orbit classification (LEO, MEO, HEO, GEO)
    -- Store directly from Space-Track when available to avoid recomputation
    orbit_class TEXT,

    -- Orbital elements (for classification if orbit_class not provided)
    period_minutes REAL,
    inclination_deg REAL,
    apogee_km REAL,
    perigee_km REAL,

    -- Object type ('PAYLOAD', 'ROCKET BODY', 'DEBRIS')
    object_type TEXT,

    -- RCS size (radar cross-section: 'SMALL', 'MEDIUM', 'LARGE')
    rcs_size TEXT,

    -- Decay date (if satellite has deorbited)
    decay_date DATE,

    -- Data source ('space-track', 'manual', etc.)
    source TEXT DEFAULT 'space-track',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_satellite_norad ON satellite(norad_id);
CREATE INDEX IF NOT EXISTS idx_satellite_owner ON satellite(owner);
CREATE INDEX IF NOT EXISTS idx_satellite_orbit_class ON satellite(orbit_class);
CREATE INDEX IF NOT EXISTS idx_satellite_launch_date ON satellite(launch_date);
CREATE INDEX IF NOT EXISTS idx_satellite_object_type ON satellite(object_type);

-- =============================================================================
-- 2. TLE TABLE
-- =============================================================================
-- Two-Line Element sets for orbit propagation

CREATE TABLE IF NOT EXISTS tle (
    id SERIAL PRIMARY KEY,

    -- Reference to satellite
    norad_id INTEGER NOT NULL REFERENCES satellite(norad_id) ON DELETE CASCADE,

    -- TLE lines (standard format for orbit propagation)
    line1 TEXT NOT NULL,
    line2 TEXT NOT NULL,

    -- TLE epoch (when this TLE was calculated)
    epoch TIMESTAMPTZ NOT NULL,

    -- Element set number (from Space-Track)
    element_set_no INTEGER,

    -- Data source
    source TEXT DEFAULT 'space-track',

    -- Collection timestamp
    collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for TLE queries
CREATE INDEX IF NOT EXISTS idx_tle_norad ON tle(norad_id);
CREATE INDEX IF NOT EXISTS idx_tle_epoch ON tle(epoch DESC);
CREATE INDEX IF NOT EXISTS idx_tle_norad_epoch ON tle(norad_id, epoch DESC);

-- =============================================================================
-- 3. TRANSMITTER TABLE
-- =============================================================================
-- RF transmitter data from SatNOGS DB

CREATE TABLE IF NOT EXISTS transmitter (
    id SERIAL PRIMARY KEY,

    -- Reference to satellite
    norad_id INTEGER NOT NULL REFERENCES satellite(norad_id) ON DELETE CASCADE,

    -- SatNOGS UUID (unique per transmitter)
    satnogs_uuid TEXT UNIQUE,

    -- Downlink frequency (Hz)
    downlink_freq_hz BIGINT,
    downlink_band TEXT,  -- 'VHF', 'UHF', 'S', 'X', 'Ku', 'Ka', etc.

    -- Uplink frequency (Hz) - if transceiver
    uplink_freq_hz BIGINT,
    uplink_band TEXT,

    -- Modulation mode ('FM', 'CW', 'LORA', 'AFSK', etc.)
    mode TEXT,

    -- Direction ('downlink', 'uplink', 'transceiver')
    direction TEXT,

    -- Status ('active', 'inactive', 'invalid')
    status TEXT,

    -- Service type ('Amateur', 'Commercial', 'Military', etc.)
    service TEXT,

    -- Raw JSON from SatNOGS (for debugging/future use)
    raw JSONB,

    -- Data source
    source TEXT DEFAULT 'satnogs',

    -- Timestamps
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for transmitter queries
CREATE INDEX IF NOT EXISTS idx_transmitter_norad ON transmitter(norad_id);
CREATE INDEX IF NOT EXISTS idx_transmitter_downlink_band ON transmitter(downlink_band);
CREATE INDEX IF NOT EXISTS idx_transmitter_uplink_band ON transmitter(uplink_band);
CREATE INDEX IF NOT EXISTS idx_transmitter_status ON transmitter(status);
CREATE INDEX IF NOT EXISTS idx_transmitter_service ON transmitter(service);
CREATE INDEX IF NOT EXISTS idx_transmitter_uuid ON transmitter(satnogs_uuid);

-- =============================================================================
-- 4. SATELLITE_TAG TABLE
-- =============================================================================
-- Classification tags for filtering (purpose, category, etc.)
-- Many-to-many relationship: one satellite can have multiple tags

CREATE TABLE IF NOT EXISTS satellite_tag (
    id SERIAL PRIMARY KEY,

    -- Reference to satellite
    norad_id INTEGER NOT NULL REFERENCES satellite(norad_id) ON DELETE CASCADE,

    -- Tag type ('PURPOSE', 'CATEGORY', 'OPERATOR', 'CUSTOM')
    tag_type TEXT NOT NULL,

    -- Tag value (e.g., 'COMMUNICATIONS', 'IMAGERY', 'WEATHER', 'MILITARY', etc.)
    tag_value TEXT NOT NULL,

    -- Confidence score (0.0-1.0) for auto-generated tags
    confidence REAL DEFAULT 1.0,

    -- Data source
    source TEXT DEFAULT 'auto',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one satellite can't have the same tag twice
    UNIQUE(norad_id, tag_type, tag_value)
);

-- Indexes for tag queries
CREATE INDEX IF NOT EXISTS idx_satellite_tag_norad ON satellite_tag(norad_id);
CREATE INDEX IF NOT EXISTS idx_satellite_tag_type_value ON satellite_tag(tag_type, tag_value);

-- =============================================================================
-- 5. INGEST_STATE TABLE
-- =============================================================================
-- Tracks last successful data fetch for delta/incremental updates

CREATE TABLE IF NOT EXISTS ingest_state (
    id SERIAL PRIMARY KEY,

    -- Source identifier ('spacetrack_satcat', 'spacetrack_tle', 'satnogs_transmitters')
    source TEXT UNIQUE NOT NULL,

    -- Last successful fetch timestamp
    last_successful_fetch_at TIMESTAMPTZ NOT NULL,

    -- Number of records fetched in last run
    last_fetch_count INTEGER DEFAULT 0,

    -- Last error message (if any)
    last_error TEXT,

    -- Timestamps
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for satellite table
DROP TRIGGER IF EXISTS update_satellite_updated_at ON satellite;
CREATE TRIGGER update_satellite_updated_at
    BEFORE UPDATE ON satellite
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for transmitter table
DROP TRIGGER IF EXISTS update_transmitter_updated_at ON transmitter;
CREATE TRIGGER update_transmitter_updated_at
    BEFORE UPDATE ON transmitter
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for ingest_state table
DROP TRIGGER IF EXISTS update_ingest_state_updated_at ON ingest_state;
CREATE TRIGGER update_ingest_state_updated_at
    BEFORE UPDATE ON ingest_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SAMPLE QUERIES FOR TESTING
-- =============================================================================

-- Query satellites by orbit class
-- SELECT * FROM satellite WHERE orbit_class = 'LEO' ORDER BY launch_date DESC LIMIT 100;

-- Query satellites by frequency band (join with transmitter)
-- SELECT DISTINCT s.* FROM satellite s
-- JOIN transmitter t ON s.norad_id = t.norad_id
-- WHERE t.downlink_band = 'Ka' AND t.status = 'active';

-- Query satellites by purpose tag
-- SELECT DISTINCT s.* FROM satellite s
-- JOIN satellite_tag st ON s.norad_id = st.norad_id
-- WHERE st.tag_type = 'PURPOSE' AND st.tag_value = 'COMMUNICATIONS';

-- Get latest TLE for a satellite
-- SELECT * FROM tle WHERE norad_id = 25544 ORDER BY epoch DESC LIMIT 1;

-- Get all transmitters for a satellite
-- SELECT * FROM transmitter WHERE norad_id = 25544 AND status = 'active';
