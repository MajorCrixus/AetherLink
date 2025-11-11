/**
 * REST API Routes
 *
 * Endpoints for querying satellite catalog data.
 * Responses are formatted for Cesium/Digital Arsenal integration.
 *
 * Routes:
 * - GET /satellites - List satellites with filters
 * - GET /satellites/:noradId - Get satellite details with focus view
 * - POST /acquire/:noradId - Queue satellite acquisition (placeholder)
 * - GET /health - Health check
 */

import express, { Request, Response } from 'express';
import { pool } from '../db/client.js';
import { ingestSpaceTrackData } from '../services/ingestSpaceTrack.js';
import { ingestSatnogsData } from '../services/ingestSatNOGS.js';

export const router = express.Router();

// Track ingest status
let ingestInProgress = false;
let lastIngestResult: any = null;
let ingestLogs: Array<{
  timestamp: string;
  type: 'info' | 'request' | 'response' | 'error';
  message: string;
  details?: any;
}> = [];

// Export function to add logs (called by ingest services)
export function addIngestLog(type: 'info' | 'request' | 'response' | 'error', message: string, details?: any) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    details,
  };
  ingestLogs.push(log);

  // Keep only last 100 logs to avoid memory issues
  if (ingestLogs.length > 100) {
    ingestLogs = ingestLogs.slice(-100);
  }
}

/**
 * GET /satellites
 *
 * Query satellites with filters:
 * - orbit: LEO, MEO, HEO, GEO
 * - band: VHF, UHF, S, X, Ku, Ka, etc.
 * - purpose: Communications, Imagery, Weather, Military, etc.
 * - owner: US, Russia, China, etc.
 * - limit: max results (default 100)
 *
 * Response format matches Cesium entity requirements.
 */
router.get('/satellites', async (req: Request, res: Response) => {
  try {
    const {
      orbit,
      band,
      purpose,
      owner,
      limit = '50000',
    } = req.query;

    // Build dynamic SQL query
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (orbit && typeof orbit === 'string') {
      conditions.push(`s.orbit_class = $${paramIndex++}`);
      params.push(orbit.toUpperCase());
    }

    if (owner && typeof owner === 'string') {
      conditions.push(`s.owner = $${paramIndex++}`);
      params.push(owner.toUpperCase());
    }

    if (band && typeof band === 'string') {
      conditions.push(`EXISTS (
        SELECT 1 FROM transmitter t
        WHERE t.norad_id = s.norad_id
        AND t.status = 'active'
        AND (t.downlink_band = $${paramIndex} OR t.uplink_band = $${paramIndex})
      )`);
      params.push(band.toUpperCase());
      paramIndex++;
    }

    if (purpose && typeof purpose === 'string') {
      conditions.push(`EXISTS (
        SELECT 1 FROM satellite_tag st
        WHERE st.norad_id = s.norad_id
        AND st.tag_type = 'PURPOSE'
        AND st.tag_value = $${paramIndex}
      )`);
      params.push(purpose.toUpperCase());
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseInt(limit as string, 10));

    // Main query with JOINs for related data
    const query = `
      WITH ranked_tles AS (
        SELECT
          norad_id,
          line1,
          line2,
          epoch,
          ROW_NUMBER() OVER (PARTITION BY norad_id ORDER BY epoch DESC) as rn
        FROM tle
      ),
      satellite_transmitters AS (
        SELECT
          norad_id,
          json_agg(
            json_build_object(
              'downlink_band', downlink_band,
              'uplink_band', uplink_band
            )
          ) FILTER (WHERE status = 'active') as transmitters
        FROM transmitter
        WHERE status = 'active'
        GROUP BY norad_id
      ),
      satellite_tags AS (
        SELECT
          norad_id,
          json_agg(
            json_build_object(
              'tag_type', tag_type,
              'tag_value', tag_value
            )
          ) as tags
        FROM satellite_tag
        GROUP BY norad_id
      )
      SELECT
        s.norad_id,
        s.name,
        s.owner,
        s.orbit_class,
        s.launch_date,
        s.object_type,
        t.line1 as tle_line1,
        t.line2 as tle_line2,
        t.epoch as tle_epoch,
        COALESCE(st.transmitters, '[]'::json) as transmitters,
        COALESCE(stags.tags, '[]'::json) as tags
      FROM satellite s
      LEFT JOIN ranked_tles t ON s.norad_id = t.norad_id AND t.rn = 1
      LEFT JOIN satellite_transmitters st ON s.norad_id = st.norad_id
      LEFT JOIN satellite_tags stags ON s.norad_id = stags.norad_id
      ${whereClause}
      ORDER BY s.launch_date DESC NULLS LAST
      LIMIT $${paramIndex}
    `;

    const result = await pool.query(query, params);

    // Format response for Cesium
    const response = result.rows.map((row: any) => {
      const bands = new Set<string>();
      const transmitters = row.transmitters || [];
      transmitters.forEach((tx: any) => {
        if (tx.downlink_band) bands.add(tx.downlink_band);
        if (tx.uplink_band) bands.add(tx.uplink_band);
      });

      const tags = row.tags || [];
      const purposes = tags
        .filter((t: any) => t.tag_type === 'PURPOSE')
        .map((t: any) => t.tag_value);

      return {
        id: `sat-${row.norad_id}`,
        norad_id: row.norad_id,
        name: row.name,
        owner: row.owner,
        orbit_class: row.orbit_class,
        launch_date: row.launch_date?.toISOString(),
        object_type: row.object_type,
        bands: Array.from(bands),
        purpose: purposes,
        tle: row.tle_line1 ? {
          line1: row.tle_line1,
          line2: row.tle_line2,
          epoch: new Date(row.tle_epoch).toISOString(),
        } : null,
      };
    });

    res.json(response);

  } catch (error) {
    console.error('[API] /satellites error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /satellites/:noradId
 *
 * Get detailed information for a specific satellite.
 * Includes "focus view" format with action buttons for Cesium.
 */
router.get('/satellites/:noradId', async (req: Request, res: Response) => {
  try {
    const noradId = parseInt(req.params.noradId, 10);

    if (isNaN(noradId)) {
      return res.status(400).json({ error: 'Invalid NORAD ID' });
    }

    // Get satellite with latest TLE
    const satQuery = `
      WITH latest_tle AS (
        SELECT
          norad_id,
          line1,
          line2,
          epoch,
          element_set_no,
          ROW_NUMBER() OVER (PARTITION BY norad_id ORDER BY epoch DESC) as rn
        FROM tle
        WHERE norad_id = $1
      )
      SELECT
        s.*,
        t.line1 as tle_line1,
        t.line2 as tle_line2,
        t.epoch as tle_epoch,
        t.element_set_no as tle_element_set_no
      FROM satellite s
      LEFT JOIN latest_tle t ON s.norad_id = t.norad_id AND t.rn = 1
      WHERE s.norad_id = $1
    `;

    const satResult = await pool.query(satQuery, [noradId]);

    if (satResult.rows.length === 0) {
      return res.status(404).json({ error: 'Satellite not found' });
    }

    const satellite = satResult.rows[0];

    // Get transmitters
    const txQuery = `
      SELECT *
      FROM transmitter
      WHERE norad_id = $1
      AND status = 'active'
      ORDER BY downlink_freq_hz ASC NULLS LAST
    `;
    const txResult = await pool.query(txQuery, [noradId]);

    // Get tags
    const tagsQuery = `
      SELECT tag_type, tag_value
      FROM satellite_tag
      WHERE norad_id = $1
    `;
    const tagsResult = await pool.query(tagsQuery, [noradId]);

    // Format transmitters
    const transmitters = txResult.rows.map((tx: any) => ({
      uuid: tx.satnogs_uuid,
      downlink_freq_mhz: tx.downlink_freq_hz ? Number(tx.downlink_freq_hz) / 1e6 : null,
      downlink_band: tx.downlink_band,
      uplink_freq_mhz: tx.uplink_freq_hz ? Number(tx.uplink_freq_hz) / 1e6 : null,
      uplink_band: tx.uplink_band,
      mode: tx.mode,
      direction: tx.direction,
      status: tx.status,
      service: tx.service,
    }));

    // Format tags
    const tagsByType: Record<string, string[]> = {};
    for (const tag of tagsResult.rows) {
      if (!tagsByType[tag.tag_type]) {
        tagsByType[tag.tag_type] = [];
      }
      tagsByType[tag.tag_type].push(tag.tag_value);
    }

    // Build response with "focus view" format
    const response = {
      norad_id: satellite.norad_id,
      name: satellite.name,
      intl_desig: satellite.intl_desig,
      owner: satellite.owner,
      launch_date: satellite.launch_date?.toISOString(),
      orbit: {
        class: satellite.orbit_class,
        period_minutes: satellite.period_minutes,
        inclination_deg: satellite.inclination_deg,
        apogee_km: satellite.apogee_km,
        perigee_km: satellite.perigee_km,
      },
      object_type: satellite.object_type,
      rcs_size: satellite.rcs_size,
      tle: satellite.tle_line1 ? {
        line1: satellite.tle_line1,
        line2: satellite.tle_line2,
        epoch: new Date(satellite.tle_epoch).toISOString(),
        element_set_no: satellite.tle_element_set_no,
      } : null,
      transmitters,
      tags: tagsByType,
      actions: [
        {
          label: 'Exit Focus',
          type: 'ui',
          description: 'Return to global view',
        },
        {
          label: 'Acquire',
          type: 'task',
          endpoint: `/api/acquire/${satellite.norad_id}`,
          description: 'Point antenna at this satellite',
        },
      ],
    };

    return res.json(response);

  } catch (error) {
    console.error(`[API] /satellites/${req.params.noradId} error:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /acquire/:noradId
 *
 * Placeholder endpoint for antenna acquisition.
 * This will eventually integrate with the Python hardware backend.
 */
router.post('/acquire/:noradId', async (req: Request, res: Response) => {
  try {
    const noradId = parseInt(req.params.noradId, 10);

    if (isNaN(noradId)) {
      return res.status(400).json({ error: 'Invalid NORAD ID' });
    }

    // Check if satellite exists
    const result = await pool.query(
      'SELECT norad_id, name FROM satellite WHERE norad_id = $1',
      [noradId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Satellite not found' });
    }

    const satellite = result.rows[0];

    // TODO: Integrate with Python hardware backend
    // For now, just return a placeholder response

    console.log(`[API] Acquisition requested for ${satellite.name} (NORAD ${noradId})`);

    return res.json({
      status: 'queued',
      norad_id: noradId,
      name: satellite.name,
      message: `Acquisition request for ${satellite.name} has been queued`,
      // TODO: Return task ID for tracking acquisition progress
    });

  } catch (error) {
    console.error(`[API] /acquire/${req.params.noradId} error:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /health
 *
 * Health check endpoint
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');

    res.json({
      status: 'ok',
      service: 'satcat-backend',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'satcat-backend',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /stats
 *
 * Get database statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [satelliteResult, tleResult, transmitterResult, tagResult] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM satellite'),
      pool.query('SELECT COUNT(*) FROM tle'),
      pool.query('SELECT COUNT(*) FROM transmitter'),
      pool.query('SELECT COUNT(*) FROM satellite_tag'),
    ]);

    res.json({
      satellites: parseInt(satelliteResult.rows[0].count, 10),
      tles: parseInt(tleResult.rows[0].count, 10),
      transmitters: parseInt(transmitterResult.rows[0].count, 10),
      tags: parseInt(tagResult.rows[0].count, 10),
    });
  } catch (error) {
    console.error('[API] /stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /ingest/start
 *
 * Trigger satellite database ingest from Space-Track.org and SatNOGS
 * This updates satellite catalog, TLEs, and transmitter data
 */
router.post('/ingest/start', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (ingestInProgress) {
      res.status(409).json({
        error: 'Ingest already in progress',
        message: 'Please wait for the current ingest to complete',
      });
      return;
    }

    // Start ingest in background
    ingestInProgress = true;
    ingestLogs = []; // Clear previous logs
    addIngestLog('info', '=== Starting database ingest ===');

    res.json({
      status: 'started',
      message: 'Database ingest started. Check /api/ingest/status for progress.',
    });

    // Run ingest asynchronously
    (async () => {
      try {
        const startTime = Date.now();

        // Run Space-Track ingest
        console.log('[Ingest API] Starting Space-Track ingest...');
        const spaceTrackResult = await ingestSpaceTrackData({ fullRefresh: false });

        // Run SatNOGS ingest
        console.log('[Ingest API] Starting SatNOGS ingest...');
        const satnogsResult = await ingestSatnogsData({ fullRefresh: false });

        const endTime = Date.now();
        const durationSeconds = ((endTime - startTime) / 1000).toFixed(1);

        lastIngestResult = {
          status: 'completed',
          timestamp: new Date().toISOString(),
          duration_seconds: parseFloat(durationSeconds),
          spacetrack: {
            satellites_inserted: spaceTrackResult.satellites.inserted,
            satellites_updated: spaceTrackResult.satellites.updated,
            tles_inserted: spaceTrackResult.tles.inserted,
          },
          satnogs: {
            transmitters_inserted: satnogsResult.transmitters.inserted,
            transmitters_updated: satnogsResult.transmitters.updated,
            transmitters_skipped: satnogsResult.transmitters.skipped,
          },
          errors: [...spaceTrackResult.errors, ...satnogsResult.errors],
        };

        console.log('[Ingest API] Completed successfully:', lastIngestResult);
      } catch (error) {
        lastIngestResult = {
          status: 'failed',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        console.error('[Ingest API] Failed:', error);
      } finally {
        ingestInProgress = false;
      }
    })();

  } catch (error) {
    ingestInProgress = false;
    console.error('[API] /ingest/start error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /ingest/status
 *
 * Get the status of the current or last ingest operation
 */
router.get('/ingest/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (ingestInProgress) {
      res.json({
        status: 'in_progress',
        message: 'Database ingest is currently running',
        logs: ingestLogs,
      });
      return;
    }

    if (lastIngestResult) {
      res.json({
        ...lastIngestResult,
        logs: ingestLogs,
      });
      return;
    }

    res.json({
      status: 'idle',
      message: 'No ingest has been run yet',
      logs: [],
    });
  } catch (error) {
    console.error('[API] /ingest/status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
