/**
 * Logging service: wraps activity_log model with convenience methods.
 * Respects debug_logging toggle from settings.
 * Never logs credentials. Masks phone numbers in debug logs.
 *
 * Related files:
 *   - ../models/activity-log.js: database storage
 *   - ../models/settings.js: debug_logging toggle
 *   - sms-engine.js: primary consumer
 */

const activityLog = require('../models/activity-log');
const { maskPhone } = require('kwtsms');

/**
 * Create a logger instance scoped to a portal.
 * @param {string} portalId
 * @param {boolean} [debugEnabled=false]
 * @returns {object} logger with info, warn, error, debug methods
 */
function createLogger(portalId, debugEnabled = false) {
  return {
    /**
     * Log an info-level message (always active).
     * @param {string} source - module/function name
     * @param {string} message
     * @param {object} [metadata]
     */
    info(source, message, metadata) {
      activityLog.log(portalId, 'info', source, message, metadata);
    },

    /**
     * Log a warning (always active).
     * @param {string} source
     * @param {string} message
     * @param {object} [metadata]
     */
    warn(source, message, metadata) {
      activityLog.log(portalId, 'warn', source, message, metadata);
    },

    /**
     * Log an error (always active).
     * @param {string} source
     * @param {string} message
     * @param {object} [metadata]
     */
    error(source, message, metadata) {
      activityLog.log(portalId, 'error', source, message, metadata);
    },

    /**
     * Log a debug message (only when debug_logging is enabled in settings).
     * Phone numbers are masked in debug metadata.
     * @param {string} source
     * @param {string} message
     * @param {object} [metadata]
     */
    debug(source, message, metadata) {
      if (!debugEnabled) return;

      // Mask phone numbers in debug metadata
      const safeMeta = metadata ? maskMetadata(metadata) : undefined;
      activityLog.log(portalId, 'debug', source, message, safeMeta);
    }
  };
}

/**
 * Recursively mask phone-like values in metadata for debug logs.
 * @param {object} obj
 * @returns {object}
 */
function maskMetadata(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskMetadata);

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('recipient')) {
      if (typeof value === 'string' && /^\d{7,15}$/.test(value)) {
        masked[key] = maskPhone(value);
      } else {
        masked[key] = value;
      }
    } else if (lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret')) {
      masked[key] = '***';
    } else if (typeof value === 'object') {
      masked[key] = maskMetadata(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

module.exports = { createLogger };
