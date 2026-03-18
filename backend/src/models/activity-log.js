/**
 * Activity log model: stores system events for debugging and auditing.
 * Supports log levels: info, warn, error, debug.
 *
 * Related files:
 *   - ../config/database.js: database connection
 *   - ../services/logger.js: high-level logging service
 *   - ../routes/logs.js: log retrieval API
 */

const { getDatabase } = require('../config/database');

/**
 * Insert a log entry.
 * @param {string} portalId
 * @param {string} level - info, warn, error, debug
 * @param {string} source - module/function name
 * @param {string} message - log message
 * @param {object} [metadata] - additional context
 */
function log(portalId, level, source, message, metadata) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO activity_log (hubspot_portal_id, level, source, message, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    portalId,
    level,
    source,
    message,
    metadata ? JSON.stringify(metadata) : null
  );
}

/**
 * Get activity logs for a portal with pagination and level filter.
 * @param {string} portalId
 * @param {object} [options]
 * @param {string} [options.level] - filter by level
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @returns {object[]}
 */
function getLogs(portalId, options = {}) {
  const db = getDatabase();
  const { level, limit = 50, offset = 0 } = options;

  let sql = 'SELECT * FROM activity_log WHERE hubspot_portal_id = ?';
  const params = [portalId];

  if (level) {
    sql += ' AND level = ?';
    params.push(level);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  }));
}

/**
 * Clear activity logs for a portal, optionally before a date.
 * @param {string} portalId
 * @param {string} [beforeDate] - ISO date string
 * @returns {number} rows deleted
 */
function clearLogs(portalId, beforeDate) {
  const db = getDatabase();

  if (beforeDate) {
    const result = db.prepare('DELETE FROM activity_log WHERE hubspot_portal_id = ? AND created_at < ?')
      .run(portalId, beforeDate);
    return result.changes;
  }

  const result = db.prepare('DELETE FROM activity_log WHERE hubspot_portal_id = ?').run(portalId);
  return result.changes;
}

module.exports = { log, getLogs, clearLogs };
