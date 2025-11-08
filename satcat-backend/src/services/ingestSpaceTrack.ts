/**
 * Space-Track Data Ingest Service
 *
 * Fetches SATCAT and TLE data from Space-Track.org and persists to database.
 * Supports delta/incremental updates to avoid re-downloading everything daily.
 *
 * Usage:
 *   import { ingestSpaceTrackData } from './services/ingestSpaceTrack.js';
 *   await ingestSpaceTrackData({ fullRefresh: false });
 */

import { spaceTrack } from '../integrations/spacetrack.js';
import { pool } from '../db/client.js';
import type { SatcatEntry, TleEntry } from '../integrations/spacetrack.js';

/**
 * Ingest options
 */
export interface IngestOptions {
  fullRefresh?: boolean;     // If true, fetch all data (ignore delta)
  limit?: number;            // Limit number of records per query
  daysBack?: number;         // For delta: fetch data updated in last N days (default: 7)
}

/**
 * Ingest result
 */
export interface IngestResult {
  satellites: { inserted: number; updated: number };
  tles: { inserted: number };
  errors: string[];
}

/**
 * Classify orbit based on orbital parameters
 */
function classifyOrbit(params: {
  periodMinutes: number;
  apogeeKm: number;
  perigeeKm: number;
  inclinationDeg: number;
}): string {
  const { periodMinutes, apogeeKm, perigeeKm } = params;
  const avgAltKm = (apogeeKm + perigeeKm) / 2;

  // GEO: ~35,786 km altitude, ~24h period
  if (avgAltKm > 35000 && avgAltKm < 36500 && periodMinutes > 1400 && periodMinutes < 1460) {
    return 'GEO';
  }

  // MEO: 2,000 km to 35,786 km
  if (avgAltKm >= 2000 && avgAltKm <= 35000) {
    return 'MEO';
  }

  // LEO: < 2,000 km
  if (avgAltKm < 2000) {
    return 'LEO';
  }

  // HEO: Highly elliptical (large difference between apogee and perigee)
  const eccentricity = (apogeeKm - perigeeKm) / (apogeeKm + perigeeKm);
  if (eccentricity > 0.25) {
    return 'HEO';
  }

  return 'UNKNOWN';
}

/**
 * Process and upsert SATCAT entry
 */
async function upsertSatellite(entry: SatcatEntry): Promise<'inserted' | 'updated'> {
  const noradId = parseInt(entry.NORAD_CAT_ID, 10);

  // Parse orbital parameters
  const periodMinutes = parseFloat(entry.PERIOD) || 0;
  const inclinationDeg = parseFloat(entry.INCLINATION) || 0;
  const apogeeKm = parseFloat(entry.APOGEE) || 0;
  const perigeeKm = parseFloat(entry.PERIGEE) || 0;

  // Classify orbit
  const orbitClass = classifyOrbit({
    periodMinutes,
    apogeeKm,
    perigeeKm,
    inclinationDeg,
  });

  // Parse dates
  const launchDate = entry.LAUNCH ? new Date(entry.LAUNCH) : null;
  const decayDate = entry.DECAY ? new Date(entry.DECAY) : null;

  // Upsert using PostgreSQL INSERT ... ON CONFLICT
  const query = `
    INSERT INTO satellite (
      norad_id, intl_desig, name, owner, launch_date,
      orbit_class, period_minutes, inclination_deg,
      apogee_km, perigee_km, object_type, rcs_size,
      decay_date, source, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
    ON CONFLICT (norad_id) DO UPDATE SET
      intl_desig = EXCLUDED.intl_desig,
      name = EXCLUDED.name,
      owner = EXCLUDED.owner,
      launch_date = EXCLUDED.launch_date,
      orbit_class = EXCLUDED.orbit_class,
      period_minutes = EXCLUDED.period_minutes,
      inclination_deg = EXCLUDED.inclination_deg,
      apogee_km = EXCLUDED.apogee_km,
      perigee_km = EXCLUDED.perigee_km,
      object_type = EXCLUDED.object_type,
      rcs_size = EXCLUDED.rcs_size,
      decay_date = EXCLUDED.decay_date,
      source = EXCLUDED.source,
      updated_at = NOW()
    RETURNING
      (xmax = 0) AS was_inserted
  `;

  const params = [
    noradId,
    entry.INTLDES || null,
    entry.OBJECT_NAME || `NORAD ${noradId}`,
    entry.COUNTRY || null,
    launchDate,
    orbitClass,
    periodMinutes,
    inclinationDeg,
    apogeeKm,
    perigeeKm,
    entry.OBJECT_TYPE || null,
    entry.RCS_SIZE || null,
    decayDate,
    'space-track',
  ];

  const result = await pool.query(query, params);
  const wasInserted = result.rows[0].was_inserted;

  return wasInserted ? 'inserted' : 'updated';
}

/**
 * Process and insert TLE entry
 */
async function insertTle(entry: TleEntry): Promise<void> {
  const noradId = parseInt(entry.NORAD_CAT_ID, 10);

  // Parse epoch
  const epoch = entry.EPOCH ? new Date(entry.EPOCH) : new Date();
  const elementSetNo = entry.ELEMENT_SET_NO ? parseInt(entry.ELEMENT_SET_NO, 10) : null;

  // Calculate time window for duplicate detection (±1 minute)
  const epochLower = new Date(epoch.getTime() - 60000); // 1 minute before
  const epochUpper = new Date(epoch.getTime() + 60000); // 1 minute after

  // Use INSERT ... ON CONFLICT DO NOTHING to avoid duplicates
  // We consider a TLE duplicate if it has the same NORAD ID and epoch (within 1 minute)
  const query = `
    INSERT INTO tle (
      norad_id, line1, line2, epoch, element_set_no, source, collected_at
    )
    SELECT $1, $2, $3, $4, $5, $6, NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM tle
      WHERE norad_id = $1
      AND epoch BETWEEN $7 AND $8
    )
  `;

  await pool.query(query, [
    noradId,
    entry.TLE_LINE1,
    entry.TLE_LINE2,
    epoch,
    elementSetNo,
    'space-track',
    epochLower,
    epochUpper,
  ]);
}

/**
 * Get last ingest timestamp for a source
 */
async function getLastIngestTime(source: string): Promise<Date | null> {
  const result = await pool.query(
    'SELECT last_successful_fetch_at FROM ingest_state WHERE source = $1',
    [source]
  );

  return result.rows.length > 0 ? result.rows[0].last_successful_fetch_at : null;
}

/**
 * Update ingest state
 */
async function updateIngestState(
  source: string,
  count: number,
  error?: string
): Promise<void> {
  const query = `
    INSERT INTO ingest_state (source, last_successful_fetch_at, last_fetch_count, last_error)
    VALUES ($1, NOW(), $2, $3)
    ON CONFLICT (source) DO UPDATE SET
      last_successful_fetch_at = NOW(),
      last_fetch_count = EXCLUDED.last_fetch_count,
      last_error = EXCLUDED.last_error
  `;

  await pool.query(query, [source, count, error || null]);
}

/**
 * Main ingest function
 */
export async function ingestSpaceTrackData(
  options: IngestOptions = {}
): Promise<IngestResult> {
  const { fullRefresh = false, limit = 1000, daysBack = 7 } = options;

  console.log('[SpaceTrack Ingest] Starting...');

  const result: IngestResult = {
    satellites: { inserted: 0, updated: 0 },
    tles: { inserted: 0 },
    errors: [],
  };

  try {
    // Login to Space-Track
    await spaceTrack.login();

    // =========================================================================
    // STEP 1: Ingest SATCAT data
    // =========================================================================
    console.log('[SpaceTrack Ingest] Fetching SATCAT...');

    let satcatParams: any = { limit };

    if (!fullRefresh) {
      // Delta mode: fetch only satellites launched/updated recently
      const lastIngest = await getLastIngestTime('spacetrack_satcat');
      if (lastIngest) {
        const sinceDate = new Date(lastIngest);
        sinceDate.setDate(sinceDate.getDate() - daysBack); // Add overlap to catch updates
        satcatParams.launched_since = sinceDate.toISOString().split('T')[0];
        console.log(`[SpaceTrack Ingest] Delta mode: fetching satellites launched since ${satcatParams.launched_since}`);
      } else {
        console.log('[SpaceTrack Ingest] No previous ingest found, running full refresh');
      }
    } else {
      console.log('[SpaceTrack Ingest] Full refresh mode');
    }

    const satcatEntries = await spaceTrack.querySatcat(satcatParams);
    console.log(`[SpaceTrack Ingest] Fetched ${satcatEntries.length} SATCAT entries`);

    // Process SATCAT entries
    for (const entry of satcatEntries) {
      try {
        const action = await upsertSatellite(entry);
        if (action === 'inserted') {
          result.satellites.inserted++;
        } else {
          result.satellites.updated++;
        }
      } catch (error) {
        const msg = `Failed to upsert satellite ${entry.NORAD_CAT_ID}: ${error instanceof Error ? error.message : error}`;
        console.error(`[SpaceTrack Ingest] ${msg}`);
        result.errors.push(msg);
      }
    }

    await updateIngestState('spacetrack_satcat', satcatEntries.length);

    // =========================================================================
    // STEP 2: Ingest TLE data
    // =========================================================================
    console.log('[SpaceTrack Ingest] Fetching TLEs...');

    let tleParams: any = { limit };

    if (!fullRefresh) {
      // Delta mode: fetch TLEs with recent epochs
      const lastIngest = await getLastIngestTime('spacetrack_tle');
      if (lastIngest) {
        const sinceDate = new Date(lastIngest);
        sinceDate.setDate(sinceDate.getDate() - daysBack);
        tleParams.epoch_since = sinceDate.toISOString().split('T')[0];
        console.log(`[SpaceTrack Ingest] Delta mode: fetching TLEs with epoch >= ${tleParams.epoch_since}`);
      }
    }

    const tleEntries = await spaceTrack.queryLatestTle(tleParams);
    console.log(`[SpaceTrack Ingest] Fetched ${tleEntries.length} TLE entries`);

    // Process TLE entries
    for (const entry of tleEntries) {
      try {
        await insertTle(entry);
        result.tles.inserted++;
      } catch (error) {
        const msg = `Failed to insert TLE for ${entry.NORAD_CAT_ID}: ${error instanceof Error ? error.message : error}`;
        console.error(`[SpaceTrack Ingest] ${msg}`);
        result.errors.push(msg);
      }
    }

    await updateIngestState('spacetrack_tle', tleEntries.length);

    console.log('[SpaceTrack Ingest] Complete:', result);

  } catch (error) {
    const msg = `Ingest failed: ${error instanceof Error ? error.message : error}`;
    console.error(`[SpaceTrack Ingest] ${msg}`);
    result.errors.push(msg);
    throw error;
  }

  return result;
}
