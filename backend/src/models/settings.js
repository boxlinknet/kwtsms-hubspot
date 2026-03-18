/**
 * Settings model: CRUD operations for kwtSMS gateway configuration.
 * Credentials are encrypted at rest using AES-256-GCM.
 * Each HubSpot portal has one settings row.
 *
 * Related files:
 *   - ../config/database.js: database connection
 *   - ../config/encryption.js: credential encryption
 *   - ../services/sms-engine.js: reads settings for send pipeline
 *   - ../routes/settings.js: settings API endpoints
 */

const { getDatabase } = require('../config/database');
const { encrypt, decrypt } = require('../config/encryption');

/**
 * Get settings for a HubSpot portal. Decrypts credentials.
 * @param {string} portalId
 * @returns {object|null} settings row with decrypted credentials, or null
 */
function getSettings(portalId) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM settings WHERE hubspot_portal_id = ?').get(portalId);
  if (!row) return null;

  return {
    ...row,
    kwtsms_username: decrypt(row.kwtsms_username),
    kwtsms_password: decrypt(row.kwtsms_password),
    available_sender_ids: JSON.parse(row.available_sender_ids || '[]'),
    coverage: JSON.parse(row.coverage || '[]'),
    gateway_enabled: Boolean(row.gateway_enabled),
    test_mode: Boolean(row.test_mode),
    debug_logging: Boolean(row.debug_logging)
  };
}

/**
 * Get settings for display (credentials masked).
 * @param {string} portalId
 * @returns {object|null}
 */
function getSettingsMasked(portalId) {
  const settings = getSettings(portalId);
  if (!settings) return null;

  return {
    ...settings,
    kwtsms_username: settings.kwtsms_username ? '****' : '',
    kwtsms_password: settings.kwtsms_password ? '****' : ''
  };
}

/**
 * Create or update settings for a portal. Encrypts credentials.
 * @param {string} portalId
 * @param {object} data - settings fields to update
 * @returns {object} updated settings (decrypted)
 */
function upsertSettings(portalId, data) {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM settings WHERE hubspot_portal_id = ?').get(portalId);

  if (existing) {
    const fields = [];
    const values = [];

    if (data.kwtsms_username !== undefined) {
      fields.push('kwtsms_username = ?');
      values.push(encrypt(data.kwtsms_username));
    }
    if (data.kwtsms_password !== undefined) {
      fields.push('kwtsms_password = ?');
      values.push(encrypt(data.kwtsms_password));
    }
    if (data.sender_id !== undefined) {
      fields.push('sender_id = ?');
      values.push(data.sender_id);
    }
    if (data.available_sender_ids !== undefined) {
      fields.push('available_sender_ids = ?');
      values.push(JSON.stringify(data.available_sender_ids));
    }
    if (data.coverage !== undefined) {
      fields.push('coverage = ?');
      values.push(JSON.stringify(data.coverage));
    }
    if (data.balance !== undefined) {
      fields.push('balance = ?');
      values.push(data.balance);
    }
    if (data.gateway_enabled !== undefined) {
      fields.push('gateway_enabled = ?');
      values.push(data.gateway_enabled ? 1 : 0);
    }
    if (data.test_mode !== undefined) {
      fields.push('test_mode = ?');
      values.push(data.test_mode ? 1 : 0);
    }
    if (data.debug_logging !== undefined) {
      fields.push('debug_logging = ?');
      values.push(data.debug_logging ? 1 : 0);
    }
    if (data.last_sync !== undefined) {
      fields.push('last_sync = ?');
      values.push(data.last_sync);
    }

    fields.push("updated_at = datetime('now')");
    values.push(portalId);

    db.prepare(`UPDATE settings SET ${fields.join(', ')} WHERE hubspot_portal_id = ?`).run(...values);
  } else {
    db.prepare(`
      INSERT INTO settings (hubspot_portal_id, kwtsms_username, kwtsms_password, sender_id,
        available_sender_ids, coverage, balance, gateway_enabled, test_mode, debug_logging)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      portalId,
      encrypt(data.kwtsms_username || ''),
      encrypt(data.kwtsms_password || ''),
      data.sender_id || 'KWT-SMS',
      JSON.stringify(data.available_sender_ids || []),
      JSON.stringify(data.coverage || []),
      data.balance || 0,
      data.gateway_enabled ? 1 : 0,
      data.test_mode !== false ? 1 : 0, // default test mode on
      data.debug_logging ? 1 : 0
    );
  }

  return getSettings(portalId);
}

/**
 * Update just the balance for a portal.
 * @param {string} portalId
 * @param {number} balance
 */
function updateBalance(portalId, balance) {
  const db = getDatabase();
  db.prepare("UPDATE settings SET balance = ?, updated_at = datetime('now') WHERE hubspot_portal_id = ?")
    .run(balance, portalId);
}

/**
 * Update cached sender IDs.
 * @param {string} portalId
 * @param {string[]} senderIds
 */
function updateSenderIds(portalId, senderIds) {
  const db = getDatabase();
  db.prepare("UPDATE settings SET available_sender_ids = ?, updated_at = datetime('now') WHERE hubspot_portal_id = ?")
    .run(JSON.stringify(senderIds), portalId);
}

/**
 * Update cached coverage data.
 * @param {string} portalId
 * @param {string[]} coverage
 */
function updateCoverage(portalId, coverage) {
  const db = getDatabase();
  db.prepare("UPDATE settings SET coverage = ?, updated_at = datetime('now') WHERE hubspot_portal_id = ?")
    .run(JSON.stringify(coverage), portalId);
}

module.exports = {
  getSettings,
  getSettingsMasked,
  upsertSettings,
  updateBalance,
  updateSenderIds,
  updateCoverage
};
