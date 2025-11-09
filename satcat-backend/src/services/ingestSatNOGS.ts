/**
 * SatNOGS Data Ingest Service
 *
 * Fetches transmitter/frequency data from SatNOGS DB and enriches satellite records.
 * Maps transmitters to NORAD IDs for cross-referencing with SATCAT.
 *
 * Usage:
 *   import { ingestSatnogsData } from './services/ingestSatNOGS.js';
 *   await ingestSatnogsData({ fullRefresh: false });
 */

import { satnogs, classifyFrequencyBand } from '../integrations/satnogs.js';
import { pool } from '../db/client.js';
import type { SatnogsTransmitter } from '../integrations/satnogs.js';

/**
 * Ingest options
 */
export interface IngestOptions {
  fullRefresh?: boolean;     // If true, fetch all data (ignore delta)
  limit?: number;            // Limit number of records
  daysBack?: number;         // For delta: fetch data updated in last N days (default: 7)
  statusFilter?: 'active' | 'inactive' | 'invalid'; // Filter by transmitter status
}

/**
 * Ingest result
 */
export interface IngestResult {
  transmitters: { inserted: number; updated: number; skipped: number };
  errors: string[];
}

/**
 * Determine transmitter direction from frequencies
 */
function getTransmitterDirection(tx: SatnogsTransmitter): string {
  const hasDownlink = tx.downlink_low !== null;
  const hasUplink = tx.uplink_low !== null;

  if (hasDownlink && hasUplink) {
    return 'transceiver';
  } else if (hasDownlink) {
    return 'downlink';
  } else if (hasUplink) {
    return 'uplink';
  } else {
    return 'unknown';
  }
}

/**
 * Process and upsert transmitter entry
 */
async function upsertTransmitter(tx: SatnogsTransmitter): Promise<'inserted' | 'updated' | 'skipped'> {
  const noradId = tx.norad_cat_id;

  // Skip if no NORAD ID
  if (!noradId) {
    console.warn(`[SatNOGS Ingest] Skipping transmitter ${tx.uuid} - no NORAD ID`);
    return 'skipped';
  }

  // Check if satellite exists in our database
  const satCheck = await pool.query(
    'SELECT norad_id FROM satellite WHERE norad_id = $1',
    [noradId]
  );

  if (satCheck.rows.length === 0) {
    console.warn(`[SatNOGS Ingest] Skipping transmitter ${tx.uuid} - satellite ${noradId} not in database`);
    return 'skipped';
  }

  // Classify frequency bands
  const downlinkBand = tx.downlink_low ? classifyFrequencyBand(tx.downlink_low) : null;
  const uplinkBand = tx.uplink_low ? classifyFrequencyBand(tx.uplink_low) : null;
  const direction = getTransmitterDirection(tx);

  // Upsert by UUID (unique identifier for transmitters)
  try {
    const query = `
      INSERT INTO transmitter (
        norad_id, satnogs_uuid, downlink_freq_hz, downlink_band,
        uplink_freq_hz, uplink_band, mode, direction,
        status, service, raw, source, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (satnogs_uuid) DO UPDATE SET
        norad_id = EXCLUDED.norad_id,
        downlink_freq_hz = EXCLUDED.downlink_freq_hz,
        downlink_band = EXCLUDED.downlink_band,
        uplink_freq_hz = EXCLUDED.uplink_freq_hz,
        uplink_band = EXCLUDED.uplink_band,
        mode = EXCLUDED.mode,
        direction = EXCLUDED.direction,
        status = EXCLUDED.status,
        service = EXCLUDED.service,
        raw = EXCLUDED.raw,
        source = EXCLUDED.source,
        updated_at = NOW()
      RETURNING (xmax = 0) AS was_inserted
    `;

    const result = await pool.query(query, [
      noradId,
      tx.uuid,
      tx.downlink_low || null,
      downlinkBand,
      tx.uplink_low || null,
      uplinkBand,
      tx.mode || null,
      direction,
      tx.status || 'unknown',
      tx.service || null,
      JSON.stringify(tx),
      'satnogs',
    ]);

    const wasInserted = result.rows[0].was_inserted;
    return wasInserted ? 'inserted' : 'updated';
  } catch (error) {
    throw new Error(`Failed to upsert transmitter: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Get last ingest timestamp
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
 * Auto-tag satellites based on transmitter data
 *
 * Adds tags like:
 * - PURPOSE: COMMUNICATIONS (if has transmitters)
 * - BAND: Ka, Ku, X, etc. (based on frequencies)
 */
async function autoTagSatellitesFromTransmitters(): Promise<void> {
  console.log('[SatNOGS Ingest] Auto-tagging satellites based on transmitter data...');

  // Get all satellites with active transmitters and their bands
  const query = `
    SELECT
      s.norad_id,
      array_agg(DISTINCT t.downlink_band) FILTER (WHERE t.downlink_band IS NOT NULL) as downlink_bands,
      array_agg(DISTINCT t.uplink_band) FILTER (WHERE t.uplink_band IS NOT NULL) as uplink_bands
    FROM satellite s
    INNER JOIN transmitter t ON s.norad_id = t.norad_id
    WHERE t.status = 'active'
    GROUP BY s.norad_id
  `;

  const result = await pool.query(query);

  for (const row of result.rows) {
    try {
      const noradId = row.norad_id;

      // Tag: PURPOSE = COMMUNICATIONS
      await pool.query(`
        INSERT INTO satellite_tag (norad_id, tag_type, tag_value, source, confidence)
        VALUES ($1, 'PURPOSE', 'COMMUNICATIONS', 'auto-satnogs', 0.8)
        ON CONFLICT (norad_id, tag_type, tag_value) DO NOTHING
      `, [noradId]);

      // Tag: BAND for each unique band
      const bands = new Set<string>();
      if (row.downlink_bands) {
        row.downlink_bands.forEach((band: string) => bands.add(band));
      }
      if (row.uplink_bands) {
        row.uplink_bands.forEach((band: string) => bands.add(band));
      }

      for (const band of bands) {
        await pool.query(`
          INSERT INTO satellite_tag (norad_id, tag_type, tag_value, source, confidence)
          VALUES ($1, 'BAND', $2, 'auto-satnogs', 1.0)
          ON CONFLICT (norad_id, tag_type, tag_value) DO NOTHING
        `, [noradId, band]);
      }
    } catch (error) {
      console.error(`[SatNOGS Ingest] Failed to auto-tag satellite ${row.norad_id}:`, error);
    }
  }

  console.log(`[SatNOGS Ingest] Auto-tagged ${result.rows.length} satellites`);
}

/**
 * Main ingest function
 */
export async function ingestSatnogsData(
  options: IngestOptions = {}
): Promise<IngestResult> {
  const {
    fullRefresh = false,
    limit, // No default limit - fetch all records
    daysBack = 7,
    statusFilter = 'active',
  } = options;

  console.log('[SatNOGS Ingest] Starting...');

  const result: IngestResult = {
    transmitters: { inserted: 0, updated: 0, skipped: 0 },
    errors: [],
  };

  try {
    // Determine query parameters
    let queryParams: any = { limit, status: statusFilter };

    if (!fullRefresh) {
      // Delta mode: fetch only transmitters updated recently
      const lastIngest = await getLastIngestTime('satnogs_transmitters');
      if (lastIngest) {
        const sinceDate = new Date(lastIngest);
        sinceDate.setDate(sinceDate.getDate() - daysBack); // Add overlap
        queryParams.updatedSince = sinceDate.toISOString();
        console.log(`[SatNOGS Ingest] Delta mode: fetching transmitters updated since ${queryParams.updatedSince}`);
      } else {
        console.log('[SatNOGS Ingest] No previous ingest found, running full refresh');
      }
    } else {
      console.log('[SatNOGS Ingest] Full refresh mode');
    }

    // Fetch transmitters
    const transmitters = await satnogs.fetchTransmitters(queryParams);
    console.log(`[SatNOGS Ingest] Fetched ${transmitters.length} transmitters`);

    // Process transmitters
    for (const tx of transmitters) {
      try {
        const action = await upsertTransmitter(tx);
        if (action === 'inserted') {
          result.transmitters.inserted++;
        } else if (action === 'updated') {
          result.transmitters.updated++;
        } else {
          result.transmitters.skipped++;
        }
      } catch (error) {
        const msg = `Failed to upsert transmitter ${tx.uuid}: ${error instanceof Error ? error.message : error}`;
        console.error(`[SatNOGS Ingest] ${msg}`);
        result.errors.push(msg);
      }
    }

    // Auto-tag satellites
    await autoTagSatellitesFromTransmitters();

    await updateIngestState('satnogs_transmitters', transmitters.length);

    console.log('[SatNOGS Ingest] Complete:', result);

  } catch (error) {
    const msg = `Ingest failed: ${error instanceof Error ? error.message : error}`;
    console.error(`[SatNOGS Ingest] ${msg}`);
    result.errors.push(msg);
    throw error;
  }

  return result;
}
