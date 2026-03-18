/**
 * Input sanitization middleware for Express.
 * Strips null bytes and trims strings in request body/query.
 *
 * Related files:
 *   - ../index.js: mounted as global middleware
 *   - error-handler.js: catches sanitization errors
 */

/**
 * Recursively sanitize values in an object.
 * @param {*} value
 * @returns {*}
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    // Strip null bytes
    let clean = value.replace(/\0/g, '');
    // Encode HTML entities to prevent XSS
    clean = clean
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    return clean.trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      clean[sanitizeValue(k)] = sanitizeValue(v);
    }
    return clean;
  }
  return value;
}

/**
 * Express middleware that sanitizes req.body and req.query.
 * Skips sanitization on fields that contain SMS message content
 * (those get cleaned by cleanMessage() before sending).
 */
function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    // Preserve raw message content, sanitize everything else
    const rawMessage = req.body.message;
    req.body = sanitizeValue(req.body);
    // Restore raw message (will be cleaned by cleanMessage() before API call)
    if (rawMessage !== undefined) {
      req.body.message = rawMessage.replace(/\0/g, '').trim();
    }
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  next();
}

module.exports = { sanitizeMiddleware, sanitizeValue };
