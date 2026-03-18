/**
 * OAuth token model: stores HubSpot OAuth access and refresh tokens.
 * Tokens are encrypted at rest using AES-256-GCM.
 *
 * Related files:
 *   - ../config/database.js: database connection
 *   - ../config/encryption.js: token encryption
 *   - ../routes/oauth.js: OAuth flow handlers
 *   - ../services/hubspot.js: uses tokens for API calls
 */

const { getDatabase } = require('../config/database');
const { encrypt, decrypt } = require('../config/encryption');

/**
 * Save or update OAuth tokens for a portal.
 * @param {string} portalId
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {string} expiresAt - ISO datetime string
 */
function saveTokens(portalId, accessToken, refreshToken, expiresAt) {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM oauth_tokens WHERE hubspot_portal_id = ?').get(portalId);

  if (existing) {
    db.prepare(`
      UPDATE oauth_tokens
      SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now')
      WHERE hubspot_portal_id = ?
    `).run(encrypt(accessToken), encrypt(refreshToken), expiresAt, portalId);
  } else {
    db.prepare(`
      INSERT INTO oauth_tokens (hubspot_portal_id, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(portalId, encrypt(accessToken), encrypt(refreshToken), expiresAt);
  }
}

/**
 * Get decrypted tokens for a portal.
 * @param {string} portalId
 * @returns {{ accessToken: string, refreshToken: string, expiresAt: string }|null}
 */
function getTokens(portalId) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM oauth_tokens WHERE hubspot_portal_id = ?').get(portalId);
  if (!row) return null;

  return {
    accessToken: decrypt(row.access_token),
    refreshToken: decrypt(row.refresh_token),
    expiresAt: row.expires_at
  };
}

/**
 * Delete tokens for a portal (on disconnect/uninstall).
 * @param {string} portalId
 */
function deleteTokens(portalId) {
  const db = getDatabase();
  db.prepare('DELETE FROM oauth_tokens WHERE hubspot_portal_id = ?').run(portalId);
}

module.exports = { saveTokens, getTokens, deleteTokens };
