/**
 * Scheduled Data Ingest Service
 *
 * Automatically runs data ingest on a schedule.
 * Can be integrated into the main server or run as a separate process.
 *
 * Usage:
 *   import { startScheduler } from './services/scheduler.js';
 *   await startScheduler();
 */

import { ingestSpaceTrackData } from './ingestSpaceTrack.js';
import { ingestSatnogsData } from './ingestSatNOGS.js';

/**
 * Scheduler configuration
 */
interface SchedulerConfig {
  intervalHours: number;  // How often to run ingest (default: 24 hours)
  runOnStartup: boolean;  // Run immediately when scheduler starts (default: false)
}

/**
 * Scheduler state
 */
let schedulerTimer: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Run a complete data ingest cycle
 */
async function runIngestCycle(): Promise<void> {
  if (isRunning) {
    console.log('[Scheduler] Ingest already running, skipping this cycle');
    return;
  }

  isRunning = true;
  console.log('[Scheduler] Starting scheduled ingest cycle...');

  try {
    // Run Space-Track ingest
    console.log('[Scheduler] Running Space-Track ingest...');
    await ingestSpaceTrackData({ fullRefresh: false });

    // Run SatNOGS ingest
    console.log('[Scheduler] Running SatNOGS ingest...');
    await ingestSatnogsData({ fullRefresh: false });

    console.log('[Scheduler] Ingest cycle complete');

  } catch (error) {
    console.error('[Scheduler] Ingest cycle failed:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduler
 */
export async function startScheduler(config?: Partial<SchedulerConfig>): Promise<void> {
  const {
    intervalHours = 24,
    runOnStartup = false,
  } = config || {};

  console.log(`[Scheduler] Starting with ${intervalHours}h interval`);

  // Run immediately if configured
  if (runOnStartup) {
    await runIngestCycle();
  }

  // Schedule periodic runs
  const intervalMs = intervalHours * 60 * 60 * 1000;
  schedulerTimer = setInterval(runIngestCycle, intervalMs);

  console.log(`[Scheduler] Next ingest cycle in ${intervalHours} hours`);
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[Scheduler] Stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  isScheduled: boolean;
  isRunning: boolean;
} {
  return {
    isScheduled: schedulerTimer !== null,
    isRunning,
  };
}
