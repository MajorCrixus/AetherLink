/**
 * PostgreSQL Client (using native pg library)
 *
 * Lightweight alternative to Prisma - works better on ARM64/Raspberry Pi
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

/**
 * PostgreSQL connection pool
 */
export const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Initialize database and create schema
 */
export async function initDatabase(): Promise<void> {
  try {
    // Test connection
    const client = await pool.connect();
    console.log('[Database] Connected to PostgreSQL');
    client.release();

    // Check if schema already exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'satellite'
      );
    `);

    const schemaExists = result.rows[0].exists;

    if (!schemaExists) {
      console.log('[Database] Creating schema...');
      await createSchema();
    } else {
      console.log('[Database] Schema already exists, skipping creation');
    }

  } catch (error) {
    console.error('[Database] Connection failed:', error);
    throw error;
  }
}

/**
 * Create database schema (tables, indexes, triggers)
 */
async function createSchema(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create satellite table
    await client.query(`
      CREATE TABLE IF NOT EXISTS satellite (
        id SERIAL PRIMARY KEY,
        norad_id INTEGER UNIQUE NOT NULL,
        intl_desig TEXT,
        name TEXT NOT NULL,
        owner TEXT,
        launch_date DATE,
        orbit_class TEXT,
        period_minutes REAL,
        inclination_deg REAL,
        apogee_km REAL,
        perigee_km REAL,
        object_type TEXT,
        rcs_size TEXT,
        decay_date DATE,
        source TEXT DEFAULT 'space-track',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create TLE table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tle (
        id SERIAL PRIMARY KEY,
        norad_id INTEGER NOT NULL REFERENCES satellite(norad_id) ON DELETE CASCADE,
        line1 TEXT NOT NULL,
        line2 TEXT NOT NULL,
        epoch TIMESTAMPTZ NOT NULL,
        element_set_no INTEGER,
        source TEXT DEFAULT 'space-track',
        collected_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create transmitter table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transmitter (
        id SERIAL PRIMARY KEY,
        norad_id INTEGER NOT NULL REFERENCES satellite(norad_id) ON DELETE CASCADE,
        satnogs_uuid TEXT UNIQUE,
        downlink_freq_hz BIGINT,
        downlink_band TEXT,
        uplink_freq_hz BIGINT,
        uplink_band TEXT,
        mode TEXT,
        direction TEXT,
        status TEXT,
        service TEXT,
        raw JSONB,
        source TEXT DEFAULT 'satnogs',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create satellite_tag table
    await client.query(`
      CREATE TABLE IF NOT EXISTS satellite_tag (
        id SERIAL PRIMARY KEY,
        norad_id INTEGER NOT NULL REFERENCES satellite(norad_id) ON DELETE CASCADE,
        tag_type TEXT NOT NULL,
        tag_value TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        source TEXT DEFAULT 'auto',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(norad_id, tag_type, tag_value)
      )
    `);

    // Create ingest_state table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ingest_state (
        id SERIAL PRIMARY KEY,
        source TEXT UNIQUE NOT NULL,
        last_successful_fetch_at TIMESTAMPTZ NOT NULL,
        last_fetch_count INTEGER DEFAULT 0,
        last_error TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_satellite_norad ON satellite(norad_id)',
      'CREATE INDEX IF NOT EXISTS idx_satellite_owner ON satellite(owner)',
      'CREATE INDEX IF NOT EXISTS idx_satellite_orbit_class ON satellite(orbit_class)',
      'CREATE INDEX IF NOT EXISTS idx_satellite_launch_date ON satellite(launch_date)',
      'CREATE INDEX IF NOT EXISTS idx_satellite_object_type ON satellite(object_type)',

      'CREATE INDEX IF NOT EXISTS idx_tle_norad ON tle(norad_id)',
      'CREATE INDEX IF NOT EXISTS idx_tle_epoch ON tle(epoch DESC)',
      'CREATE INDEX IF NOT EXISTS idx_tle_norad_epoch ON tle(norad_id, epoch DESC)',

      'CREATE INDEX IF NOT EXISTS idx_transmitter_norad ON transmitter(norad_id)',
      'CREATE INDEX IF NOT EXISTS idx_transmitter_downlink_band ON transmitter(downlink_band)',
      'CREATE INDEX IF NOT EXISTS idx_transmitter_uplink_band ON transmitter(uplink_band)',
      'CREATE INDEX IF NOT EXISTS idx_transmitter_status ON transmitter(status)',
      'CREATE INDEX IF NOT EXISTS idx_transmitter_uuid ON transmitter(satnogs_uuid)',

      'CREATE INDEX IF NOT EXISTS idx_satellite_tag_norad ON satellite_tag(norad_id)',
      'CREATE INDEX IF NOT EXISTS idx_satellite_tag_type_value ON satellite_tag(tag_type, tag_value)',
    ];

    for (const indexQuery of indexes) {
      await client.query(indexQuery);
    }

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Create triggers
    const triggers = [
      `DROP TRIGGER IF EXISTS update_satellite_updated_at ON satellite;
       CREATE TRIGGER update_satellite_updated_at
       BEFORE UPDATE ON satellite
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

      `DROP TRIGGER IF EXISTS update_transmitter_updated_at ON transmitter;
       CREATE TRIGGER update_transmitter_updated_at
       BEFORE UPDATE ON transmitter
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

      `DROP TRIGGER IF EXISTS update_ingest_state_updated_at ON ingest_state;
       CREATE TRIGGER update_ingest_state_updated_at
       BEFORE UPDATE ON ingest_state
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
    ];

    for (const triggerQuery of triggers) {
      await client.query(triggerQuery);
    }

    await client.query('COMMIT');
    console.log('[Database] Schema created successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Database] Schema creation failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
  console.log('[Database] Disconnected from PostgreSQL');
}

/**
 * Health check
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1');
    return result.rowCount === 1;
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return false;
  }
}

/**
 * Query helper
 */
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('[Database] Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
  return res;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});
