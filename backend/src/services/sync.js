/**
 * Daily sync service: refreshes balance, sender IDs, and coverage
 * from kwtSMS API for all configured portals.
 *
 * Related files:
 *   - ../models/settings.js: reads/updates cached data
 *   - ../jobs/daily-sync.js: schedules this service
 *   - logger.js: activity logging
 */

const { KwtSMS } = require('kwtsms');
const { getDatabase } = require('../config/database');
const { decrypt } = require('../config/encryption');
const { updateBalance, updateSenderIds, updateCoverage } = require('../models/settings');
const { createLogger } = require('./logger');

/**
 * Sync balance, sender IDs, and coverage for a single portal.
 * Partial failures are logged but do not stop the sync.
 *
 * @param {string} portalId
 * @param {string} username - decrypted API username
 * @param {string} password - decrypted API password
 * @returns {Promise<{ success: boolean, balance?: number, errors: string[] }>}
 */
async function syncPortal(portalId, username, password) {
  const logger = createLogger(portalId);
  const errors = [];
  let balance = null;

  const sms = new KwtSMS(username, password, { testMode: false, logFile: '' });

  // Sync balance
  try {
    balance = await sms.balance();
    if (balance != null) {
      updateBalance(portalId, balance);
    } else {
      errors.push('Balance fetch returned null');
    }
  } catch (e) {
    errors.push(`Balance sync failed: ${e.message}`);
    logger.error('sync.syncPortal', 'Balance sync failed', { error: e.message });
  }

  // Sync sender IDs
  try {
    const result = await sms.senderids();
    if (result.result === 'OK' && result.senderids) {
      updateSenderIds(portalId, result.senderids);
    } else {
      errors.push(`SenderID fetch error: ${result.code || 'unknown'}`);
    }
  } catch (e) {
    errors.push(`SenderID sync failed: ${e.message}`);
    logger.error('sync.syncPortal', 'SenderID sync failed', { error: e.message });
  }

  // Sync coverage
  try {
    const result = await sms.coverage();
    const prefixes = result.prefixes || result.coverage;
    if (result.result === 'OK' && prefixes) {
      updateCoverage(portalId, prefixes);
    } else {
      errors.push(`Coverage fetch error: ${result.code || 'unknown'}`);
    }
  } catch (e) {
    errors.push(`Coverage sync failed: ${e.message}`);
    logger.error('sync.syncPortal', 'Coverage sync failed', { error: e.message });
  }

  // Update last_sync timestamp
  const db = getDatabase();
  db.prepare("UPDATE settings SET last_sync = datetime('now'), updated_at = datetime('now') WHERE hubspot_portal_id = ?")
    .run(portalId);

  if (errors.length === 0) {
    logger.info('sync.syncPortal', 'Daily sync completed successfully', { balance });
  } else {
    logger.warn('sync.syncPortal', `Daily sync completed with ${errors.length} error(s)`, { errors, balance });
  }

  return { success: errors.length === 0, balance, errors };
}

/**
 * Run daily sync for all configured portals.
 * @returns {Promise<{ synced: number, failed: number }>}
 */
async function syncAll() {
  const db = getDatabase();
  const portals = db.prepare(`
    SELECT hubspot_portal_id, kwtsms_username, kwtsms_password
    FROM settings
    WHERE kwtsms_username != '' AND kwtsms_password != ''
  `).all();

  let synced = 0;
  let failed = 0;

  for (const portal of portals) {
    try {
      const username = decrypt(portal.kwtsms_username);
      const password = decrypt(portal.kwtsms_password);
      const result = await syncPortal(portal.hubspot_portal_id, username, password);
      if (result.success) synced++;
      else failed++;
    } catch (e) {
      console.error(`Sync failed for portal ${portal.hubspot_portal_id}: ${e.message}`);
      failed++;
    }
  }

  console.log(`Daily sync complete: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}

module.exports = { syncPortal, syncAll };
