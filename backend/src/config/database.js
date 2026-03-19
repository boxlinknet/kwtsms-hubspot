/**
 * SQLite database initialization using sql.js (pure JavaScript, no native deps).
 * API wrapper provides better-sqlite3-compatible interface.
 *
 * Related files:
 *   - ../migrations/001_initial_schema.js: table definitions
 *   - ../models/*.js: data access layer
 *   - encryption.js: credential encryption
 */

const initSqlJs = require('sql.js');
const path = require('node:path');
const fs = require('node:fs');

let db = null;
let rawDb = null;
let dbPath = null;
let sqljs = null;

/**
 * Save database to disk. Called after every write operation.
 */
function saveToDisk() {
  if (rawDb && dbPath) {
    const data = rawDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * Wrapper that mimics better-sqlite3's prepare().run/all/get API.
 */
function createWrapper(database) {
  const wrapper = {
    prepare(sql) {
      return {
        run(...params) {
          database.run(sql, params);
          saveToDisk();
          const changes = database.getRowsModified();
          const info = database.exec("SELECT last_insert_rowid() as id");
          const lastId = info.length > 0 ? info[0].values[0][0] : 0;
          return { changes, lastInsertRowid: lastId };
        },
        get(...params) {
          const stmt = database.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const results = [];
          const stmt = database.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        }
      };
    },
    pragma(val) {
      try { database.run('PRAGMA ' + val); } catch (e) { /* ignore pragma errors */ }
    },
    transaction(fn) {
      return function() {
        database.run('BEGIN');
        try {
          fn(wrapper);
          database.run('COMMIT');
          saveToDisk();
        } catch (e) {
          try { database.run('ROLLBACK'); } catch (_) { /* already rolled back */ }
          throw e;
        }
      };
    },
    close() {
      saveToDisk();
      database.close();
    }
  };
  return wrapper;
}

/**
 * Initialize and return the database connection.
 * @param {string} [overridePath] - override database path (for testing)
 * @returns {object} database wrapper with prepare/pragma/transaction/close
 */
async function initDatabase(overridePath) {
  if (db) return db;

  dbPath = overridePath || process.env.DATABASE_PATH || path.join(__dirname, '../../data/kwtsms.db');

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!sqljs) {
    sqljs = await initSqlJs();
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    rawDb = new sqljs.Database(fileBuffer);
  } else {
    rawDb = new sqljs.Database();
  }
  db = createWrapper(rawDb);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  return db;
}

/**
 * Get database synchronously (must call initDatabase first).
 * @returns {object}
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Run all pending migrations.
 */
function runMigrations(database) {
  database.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT (datetime('now'))
    )
  `).run();

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

function closeDatabase() {
  if (db) {
    saveToDisk();
    rawDb.close();
    db = null;
    rawDb = null;
  }
}

module.exports = { initDatabase, getDatabase, closeDatabase };
