/**
 * AES-256-GCM encryption utilities for storing API credentials at rest.
 * Uses Node.js built-in crypto module. No external dependencies.
 *
 * Encrypted values are stored as a single string: "iv:tag:ciphertext" (hex encoded).
 * The encryption key comes from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 *
 * Related files:
 *   - database.js: uses encryption for credential storage
 *   - ../models/settings.js: encrypts/decrypts kwtSMS credentials
 *   - ../models/oauth-token.js: encrypts/decrypts HubSpot tokens
 */

const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * @returns {Buffer} 32-byte key
 * @throws {Error} if key is missing or invalid length
 */
function getKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    // Development fallback (NOT secure, for local dev only)
    return crypto.scryptSync('kwtsms-dev-key-not-for-production', 'salt', 32);
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param {string} plaintext - text to encrypt
 * @returns {string} encrypted string in format "iv:tag:ciphertext" (hex)
 */
function encrypt(plaintext) {
  if (!plaintext) return '';

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string produced by encrypt().
 *
 * @param {string} encryptedString - string in format "iv:tag:ciphertext" (hex)
 * @returns {string} decrypted plaintext
 * @throws {Error} if decryption fails (wrong key, tampered data)
 */
function decrypt(encryptedString) {
  if (!encryptedString) return '';

  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format');
  }

  const key = getKey();
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { encrypt, decrypt };
