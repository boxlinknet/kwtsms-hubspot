/**
 * Daily sync scheduler using node-cron.
 * Syncs balance, sender IDs, and coverage for all configured portals.
 * Default schedule: 03:00 AM daily.
 *
 * Related files:
 *   - ../services/sync.js: actual sync logic
 *   - ../index.js: starts the scheduler
 */

const cron = require('node-cron');
const { syncAll } = require('../services/sync');

let task = null;

/**
 * Start the daily sync cron job.
 * @param {string} [schedule='0 3 * * *'] - cron expression (default: 3 AM daily)
 */
function startDailySync(schedule = '0 3 * * *') {
  if (task) {
    task.stop();
  }

  task = cron.schedule(schedule, async () => {
    console.log(`[${new Date().toISOString()}] Starting daily sync...`);
    try {
      const result = await syncAll();
      console.log(`[${new Date().toISOString()}] Daily sync done: ${result.synced} synced, ${result.failed} failed`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Daily sync error:`, err.message);
    }
  });

  console.log(`Daily sync scheduled: ${schedule}`);
}

/**
 * Stop the cron job.
 */
function stopDailySync() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { startDailySync, stopDailySync };
