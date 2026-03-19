module.exports = {
  up(db) {
    db.prepare(`ALTER TABLE settings ADD COLUMN default_country_code TEXT DEFAULT ''`).run();
  }
};
