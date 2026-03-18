/**
 * SQLite database initialization using better-sqlite3.
 * Creates database file and runs migrations on first use.
 * Uses WAL mode for better concurrent read performance.
 *
 * Related files:
 *   - ../migrations/001_initial_schema.js: table definitions
 *   - ../models/*.js: data access layer
 *   - encryption.js: credential encryption
 */

const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

let db = null;

/**
 * Initialize and return the database connection.
 * Creates the data directory and database file if needed.
 * Runs migrations on startup.
 *
 * @param {string} [dbPath] - override database path (for testing)
 * @returns {Database} better-sqlite3 instance
 */
function getDatabase(dbPath) {
  if (db) return db;

  const resolvedPath = dbPath || process.env.DATABASE_PATH || path.join(__dirname, '../../data/kwtsms.db');

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  // Enable WAL mode for better concurrent reads
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  return db;
}

/**
 * Run all pending migrations.
 * Uses a simple migrations table to track what has run.
 *
 * @param {Database} database
 */
function runMigrations(database) {
  // Create migrations tracking table
  // Note: database.exec() here is better-sqlite3's SQL execution method,
  // not child_process.exec(). It runs parameterized SQL safely.
  database.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT (datetime('now'))
    )
  `).run();

  // Load and run migrations
  const migrationsDir = path.join(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  const applied = new Set(
    database.prepare('SELECT name FROM _migrations').all().map(r => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const migration = require(path.join(migrationsDir, file));
    database.transaction(() => {
      migration.up(database);
      database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();

    console.log(`Migration applied: ${file}`);
  }
}

/**
 * Close the database connection. Used in tests and shutdown.
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDatabase, closeDatabase };
