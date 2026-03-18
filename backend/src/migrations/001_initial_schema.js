/**
 * Initial database schema: settings, sms_log, activity_log, oauth_tokens.
 * All tables scoped by hubspot_portal_id for multi-tenant support.
 *
 * Note: Uses better-sqlite3's db.prepare().run() for DDL statements.
 * These are SQL execution methods, not child_process calls.
 *
 * Related files:
 *   - ../config/database.js: runs this migration on startup
 *   - ../models/*.js: CRUD operations on these tables
 */

module.exports = {
  up(db) {
    // Settings table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hubspot_portal_id TEXT NOT NULL UNIQUE,
        kwtsms_username TEXT DEFAULT '',
        kwtsms_password TEXT DEFAULT '',
        sender_id TEXT DEFAULT 'KWT-SMS',
        available_sender_ids TEXT DEFAULT '[]',
        coverage TEXT DEFAULT '[]',
        balance REAL DEFAULT 0,
        gateway_enabled INTEGER DEFAULT 0,
        test_mode INTEGER DEFAULT 1,
        debug_logging INTEGER DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();

    // SMS log table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sms_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hubspot_portal_id TEXT NOT NULL,
        hubspot_contact_id TEXT,
        recipient_phone TEXT NOT NULL,
        message_text TEXT NOT NULL,
        sender_id TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        test_mode INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        kwtsms_result TEXT,
        kwtsms_msg_id TEXT,
        kwtsms_error_code TEXT,
        kwtsms_error_desc TEXT,
        points_charged INTEGER DEFAULT 0,
        balance_after REAL,
        api_response_raw TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sms_log_portal_date
        ON sms_log (hubspot_portal_id, created_at)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sms_log_contact
        ON sms_log (hubspot_contact_id)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sms_log_status
        ON sms_log (hubspot_portal_id, status)
    `).run();

    // Activity log table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hubspot_portal_id TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_activity_log_portal_level
        ON activity_log (hubspot_portal_id, level, created_at)
    `).run();

    // OAuth tokens table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hubspot_portal_id TEXT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  }
};
