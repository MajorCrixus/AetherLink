/**
 * CLI Tool for Manual Data Ingest
 *
 * Usage:
 *   npm run ingest                     - Run incremental ingest (delta mode)
 *   npm run ingest -- --full           - Run full refresh
 *   npm run ingest -- --spacetrack     - Ingest only Space-Track data
 *   npm run ingest -- --satnogs        - Ingest only SatNOGS data
 */

import { initDatabase, closeDatabase } from '../db/client.js';
import { ingestSpaceTrackData } from '../services/ingestSpaceTrack.js';
import { ingestSatnogsData } from '../services/ingestSatNOGS.js';

interface CliOptions {
  full: boolean;
  spacetrackOnly: boolean;
  satnogsOnly: boolean;
  limit?: number;
}

/**
 * Parse CLI arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  return {
    full: args.includes('--full'),
    spacetrackOnly: args.includes('--spacetrack'),
    satnogsOnly: args.includes('--satnogs'),
    limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : undefined,
  };
}

/**
 * Main ingest function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  console.log('='.repeat(60));
  console.log('AetherLink Satellite Catalog - Data Ingest');
  console.log('='.repeat(60));
  console.log('Mode:', options.full ? 'FULL REFRESH' : 'DELTA/INCREMENTAL');
  console.log('='.repeat(60));

  try {
    // Connect to database
    await initDatabase();

    // Run Space-Track ingest
    if (!options.satnogsOnly) {
      console.log('\n[Ingest] Starting Space-Track ingest...\n');
      const spacetrackResult = await ingestSpaceTrackData({
        fullRefresh: options.full,
        limit: options.limit,
      });

      console.log('\n[Ingest] Space-Track Results:');
      console.log(`  Satellites inserted: ${spacetrackResult.satellites.inserted}`);
      console.log(`  Satellites updated:  ${spacetrackResult.satellites.updated}`);
      console.log(`  TLEs inserted:       ${spacetrackResult.tles.inserted}`);
      if (spacetrackResult.errors.length > 0) {
        console.log(`  Errors:              ${spacetrackResult.errors.length}`);
        spacetrackResult.errors.forEach(err => console.error(`    - ${err}`));
      }
    }

    // Run SatNOGS ingest
    if (!options.spacetrackOnly) {
      console.log('\n[Ingest] Starting SatNOGS ingest...\n');
      const satnogsResult = await ingestSatnogsData({
        fullRefresh: options.full,
        limit: options.limit,
      });

      console.log('\n[Ingest] SatNOGS Results:');
      console.log(`  Transmitters inserted: ${satnogsResult.transmitters.inserted}`);
      console.log(`  Transmitters updated:  ${satnogsResult.transmitters.updated}`);
      console.log(`  Transmitters skipped:  ${satnogsResult.transmitters.skipped}`);
      if (satnogsResult.errors.length > 0) {
        console.log(`  Errors:                ${satnogsResult.errors.length}`);
        satnogsResult.errors.forEach(err => console.error(`    - ${err}`));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('[Ingest] Complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n[Ingest] FAILED:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
