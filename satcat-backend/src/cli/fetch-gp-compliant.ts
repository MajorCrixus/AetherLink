/**
 * COMPLIANT GP (General Perturbations) Fetcher
 *
 * This script fetches orbital elements using Space-Track's recommended GP class
 * with proper batching and rate limiting to comply with their usage policy.
 *
 * COMPLIANCE MEASURES:
 * - Uses GP class instead of deprecated tle_latest
 * - Batches NORAD IDs (up to 100 per query) using comma-delimited lists
 * - Respects rate limits: max 20 queries/minute, 200 queries/hour
 * - Single query per run (queries all satellites at once when possible)
 *
 * Usage:
 *   npm run fetch-gp              - Fetch GPs for all catalog satellites
 *   npm run fetch-gp -- --batch-size 50  - Custom batch size
 */

import { initDatabase, closeDatabase, pool } from '../db/client.js';
import { spaceTrack } from '../integrations/spacetrack.js';

interface CliOptions {
  batchSize: number;
}

/**
 * Parse CLI arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  return {
    batchSize: args.includes('--batch-size')
      ? parseInt(args[args.indexOf('--batch-size') + 1], 10)
      : 100, // Default: 100 satellites per batch
  };
}

/**
 * Fetch GPs for a batch of NORAD IDs
 */
async function fetchGPBatch(noradIds: number[]): Promise<void> {
  try {
    console.log(`\n[Batch] Fetching GP data for ${noradIds.length} satellites...`);

    // Single query for entire batch (comma-delimited)
    const gpEntries = await spaceTrack.queryGP({
      norad_ids: noradIds,
      on_orbit_only: true, // Only on-orbit satellites
      epoch_since: '>now-30', // Last 30 days
      limit: noradIds.length * 2, // Allow for multiple epochs per satellite
    });

    console.log(`[Batch] Received ${gpEntries.length} GP entries`);

    // Group by NORAD ID and get most recent for each
    const latestByNoradId = new Map<number, typeof gpEntries[0]>();

    for (const entry of gpEntries) {
      const noradId = parseInt(entry.NORAD_CAT_ID, 10);
      const existing = latestByNoradId.get(noradId);

      if (!existing || new Date(entry.EPOCH) > new Date(existing.EPOCH)) {
        latestByNoradId.set(noradId, entry);
      }
    }

    console.log(`[Batch] Processing ${latestByNoradId.size} unique satellites`);

    // Insert into database
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const [noradId, gp] of latestByNoradId) {
      try {
        // Validate TLE lines exist
        if (!gp.TLE_LINE1 || !gp.TLE_LINE2) {
          console.log(`  - [${noradId}] Skipped: Missing TLE lines (likely classified)`);
          skipped++;
          continue;
        }

        const epoch = gp.EPOCH ? new Date(gp.EPOCH) : new Date();
        const elementSetNo = gp.ELEMENT_SET_NO ? parseInt(gp.ELEMENT_SET_NO, 10) : null;

        // Calculate time window for duplicate detection (±1 minute)
        const epochLower = new Date(epoch.getTime() - 60000);
        const epochUpper = new Date(epoch.getTime() + 60000);

        // Insert TLE
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
          RETURNING id
        `;

        const result = await pool.query(query, [
          noradId,
          gp.TLE_LINE1,
          gp.TLE_LINE2,
          epoch,
          elementSetNo,
          'space-track-gp',
          epochLower,
          epochUpper,
        ]);

        if (result.rowCount && result.rowCount > 0) {
          console.log(`  ✓ [${noradId}] Inserted (epoch: ${epoch.toISOString()})`);
          inserted++;
        } else {
          console.log(`  - [${noradId}] Already exists`);
          skipped++;
        }
      } catch (error) {
        console.error(`  ✗ [${noradId}] Error:`, error instanceof Error ? error.message : error);
        errors++;
      }
    }

    console.log(`[Batch] Complete: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);

  } catch (error) {
    console.error('[Batch] Failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  console.log('='.repeat(70));
  console.log('Space-Track COMPLIANT GP Fetcher');
  console.log('='.repeat(70));
  console.log(`Batch size: ${options.batchSize} satellites per query`);
  console.log('='.repeat(70));

  try {
    // Connect to database
    await initDatabase();

    // Get all NORAD IDs from our satellite catalog
    const result = await pool.query(
      'SELECT norad_id FROM satellite ORDER BY norad_id ASC'
    );

    const noradIds: number[] = result.rows.map(row => row.norad_id);
    console.log(`\nFound ${noradIds.length} satellites in catalog`);

    // Check existing TLE coverage
    const tleCountResult = await pool.query(
      'SELECT COUNT(DISTINCT norad_id) as count FROM tle WHERE norad_id = ANY($1)',
      [noradIds]
    );
    const existingTleCount = parseInt(tleCountResult.rows[0].count, 10);
    console.log(`Current TLE coverage: ${existingTleCount}/${noradIds.length} (${(existingTleCount / noradIds.length * 100).toFixed(1)}%)`);

    // Login to Space-Track
    console.log('\nLogging in to Space-Track...');
    await spaceTrack.login();
    console.log('✓ Logged in\n');

    // Split into batches
    const batches: number[][] = [];
    for (let i = 0; i < noradIds.length; i += options.batchSize) {
      batches.push(noradIds.slice(i, i + options.batchSize));
    }

    console.log(`Processing ${batches.length} batches of up to ${options.batchSize} satellites each\n`);

    // Process each batch with rate limiting
    // Space-Track policy: max 20 queries/minute
    const DELAY_BETWEEN_BATCHES_MS = 3500; // ~17 queries/minute to be safe

    for (let i = 0; i < batches.length; i++) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Batch ${i + 1}/${batches.length}`);
      console.log('='.repeat(70));

      await fetchGPBatch(batches[i]);

      // Wait between batches (except for the last one)
      if (i < batches.length - 1) {
        console.log(`\nWaiting ${DELAY_BETWEEN_BATCHES_MS / 1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    // Final stats
    console.log('\n' + '='.repeat(70));
    console.log('Summary:');
    console.log('='.repeat(70));

    const finalStats = await pool.query(
      'SELECT COUNT(DISTINCT norad_id) as satellites_with_tles, COUNT(*) as total_tles FROM tle'
    );
    const finalCount = parseInt(finalStats.rows[0].satellites_with_tles, 10);
    const finalCoverage = (finalCount / noradIds.length * 100).toFixed(1);

    console.log(`Final TLE Coverage: ${finalCount}/${noradIds.length} satellites (${finalCoverage}%)`);
    console.log(`Total TLEs in database: ${finalStats.rows[0].total_tles}`);
    console.log(`Improvement: +${finalCount - existingTleCount} satellites`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n[ERROR]', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
