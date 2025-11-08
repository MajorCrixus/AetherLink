/**
 * Fetch TLEs for all satellites in our catalog
 *
 * This script fetches TLEs specifically for the NORAD IDs we have in our database,
 * rather than fetching TLEs by date which may not match our satellite list.
 *
 * Usage:
 *   npm run fetch-tles
 */

import { initDatabase, closeDatabase, pool } from '../db/client.js';
import { spaceTrack } from '../integrations/spacetrack.js';

/**
 * Fetch TLE for a specific NORAD ID
 */
async function fetchTleForNoradId(noradId: number): Promise<void> {
  try {
    // Query Space-Track for latest TLE for this NORAD ID
    const tles = await spaceTrack.queryLatestTle({
      norad_ids: [noradId],  // Pass as array with correct parameter name
      limit: 1,
    });

    if (tles.length === 0) {
      console.log(`  [${noradId}] No TLE found`);
      return;
    }

    const tle = tles[0];

    // Validate TLE has required line1 and line2 fields
    if (!tle.TLE_LINE1 || !tle.TLE_LINE2) {
      console.log(`  [${noradId}] TLE found but missing line data (likely classified/analyst object)`);
      return;
    }

    const epoch = tle.EPOCH ? new Date(tle.EPOCH) : new Date();
    const elementSetNo = tle.ELEMENT_SET_NO ? parseInt(tle.ELEMENT_SET_NO, 10) : null;

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
      tle.TLE_LINE1,
      tle.TLE_LINE2,
      epoch,
      elementSetNo,
      'space-track',
      epochLower,
      epochUpper,
    ]);

    if (result.rowCount && result.rowCount > 0) {
      console.log(`  ✓ [${noradId}] TLE inserted (epoch: ${epoch.toISOString()})`);
    } else {
      console.log(`  - [${noradId}] TLE already exists`);
    }
  } catch (error) {
    console.error(`  ✗ [${noradId}] Failed:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('Fetch TLEs for All Satellites in Catalog');
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

    // Check how many already have TLEs
    const tleCountResult = await pool.query(
      'SELECT COUNT(DISTINCT norad_id) as count FROM tle WHERE norad_id = ANY($1)',
      [noradIds]
    );
    const existingTleCount = parseInt(tleCountResult.rows[0].count, 10);
    console.log(`${existingTleCount} satellites already have TLEs`);
    console.log(`${noradIds.length - existingTleCount} satellites need TLEs`);

    // Login to Space-Track
    console.log('\nLogging in to Space-Track...');
    await spaceTrack.login();
    console.log('✓ Logged in\n');

    // Fetch TLEs in batches (rate-limited by Space-Track client)
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    console.log('Fetching TLEs...\n');
    for (let i = 0; i < noradIds.length; i++) {
      const noradId = noradIds[i];
      process.stdout.write(`[${i + 1}/${noradIds.length}] `);

      try {
        await fetchTleForNoradId(noradId);
        successCount++;
      } catch (error) {
        errorCount++;
      }

      // Progress update every 50 satellites
      if ((i + 1) % 50 === 0) {
        console.log(`\n--- Progress: ${i + 1}/${noradIds.length} ---\n`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('Summary:');
    console.log(`  Total satellites: ${noradIds.length}`);
    console.log(`  TLEs fetched:     ${successCount}`);
    console.log(`  Errors:           ${errorCount}`);
    console.log('='.repeat(70));

    // Final stats
    const finalStats = await pool.query(
      'SELECT COUNT(DISTINCT norad_id) as satellites_with_tles, COUNT(*) as total_tles FROM tle'
    );
    console.log(`\nFinal TLE Coverage: ${finalStats.rows[0].satellites_with_tles}/${noradIds.length} satellites`);
    console.log(`Total TLEs in database: ${finalStats.rows[0].total_tles}`);

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
