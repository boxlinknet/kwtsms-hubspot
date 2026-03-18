/**
 * SMS log model: stores every send attempt with full API response.
 * Phone numbers stored in full (not masked) per project requirements.
 *
 * Related files:
 *   - ../config/database.js: database connection
 *   - ../services/sms-engine.js: creates log entries after each send
 *   - ../routes/logs.js: log retrieval API
 */

const { getDatabase } = require('../config/database');

/**
 * Create a new SMS log entry.
 * @param {object} data
 * @returns {object} created row with id
 */
function createLog(data) {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO sms_log (
      hubspot_portal_id, hubspot_contact_id, recipient_phone, message_text,
      sender_id, source, test_mode, status, kwtsms_result, kwtsms_msg_id,
      kwtsms_error_code, kwtsms_error_desc, points_charged, balance_after,
      api_response_raw
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.hubspot_portal_id,
    data.hubspot_contact_id || null,
    data.recipient_phone,
    data.message_text,
    data.sender_id || null,
    data.source || 'manual',
    data.test_mode ? 1 : 0,
    data.status || 'pending',
    data.kwtsms_result || null,
    data.kwtsms_msg_id || null,
    data.kwtsms_error_code || null,
    data.kwtsms_error_desc || null,
    data.points_charged || 0,
    data.balance_after != null ? data.balance_after : null,
    data.api_response_raw ? JSON.stringify(data.api_response_raw) : null
  );

  return { id: result.lastInsertRowid, ...data };
}

/**
 * Get SMS logs for a portal with pagination and filters.
 * @param {string} portalId
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @param {string} [options.status] - filter by status (sent, failed, skipped)
 * @param {string} [options.dateFrom] - ISO date string
 * @param {string} [options.dateTo] - ISO date string
 * @returns {object[]}
 */
function getLogsByPortal(portalId, options = {}) {
  const db = getDatabase();
  const { limit = 50, offset = 0, status, dateFrom, dateTo } = options;

  let sql = 'SELECT * FROM sms_log WHERE hubspot_portal_id = ?';
  const params = [portalId];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (dateFrom) {
    sql += ' AND created_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += ' AND created_at <= ?';
    params.push(dateTo);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

/**
 * Get SMS logs for a specific contact.
 * @param {string} portalId
 * @param {string} contactId
 * @param {number} [limit=20]
 * @returns {object[]}
 */
function getLogsByContact(portalId, contactId, limit = 20) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM sms_log
    WHERE hubspot_portal_id = ? AND hubspot_contact_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(portalId, contactId, limit);
}

/**
 * Get SMS statistics for a portal.
 * @param {string} portalId
 * @param {string} [period] - 'today', 'week', 'month', or null for all time
 * @returns {{ totalSent: number, totalFailed: number, totalSkipped: number, creditsUsed: number }}
 */
function getStats(portalId, period) {
  const db = getDatabase();

  let dateFilter = '';
  if (period === 'today') {
    dateFilter = "AND created_at >= date('now')";
  } else if (period === 'week') {
    dateFilter = "AND created_at >= date('now', '-7 days')";
  } else if (period === 'month') {
    dateFilter = "AND created_at >= date('now', '-30 days')";
  }

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) AS totalSent,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS totalFailed,
      COALESCE(SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END), 0) AS totalSkipped,
      COALESCE(SUM(points_charged), 0) AS creditsUsed
    FROM sms_log
    WHERE hubspot_portal_id = ? ${dateFilter}
  `).get(portalId);

  return row;
}

/**
 * Clear SMS logs for a portal, optionally before a date.
 * @param {string} portalId
 * @param {string} [beforeDate] - ISO date string, clear logs before this date
 * @returns {number} number of rows deleted
 */
function clearLogs(portalId, beforeDate) {
  const db = getDatabase();

  if (beforeDate) {
    const result = db.prepare('DELETE FROM sms_log WHERE hubspot_portal_id = ? AND created_at < ?')
      .run(portalId, beforeDate);
    return result.changes;
  }

  const result = db.prepare('DELETE FROM sms_log WHERE hubspot_portal_id = ?').run(portalId);
  return result.changes;
}

module.exports = {
  createLog,
  getLogsByPortal,
  getLogsByContact,
  getStats,
  clearLogs
};
