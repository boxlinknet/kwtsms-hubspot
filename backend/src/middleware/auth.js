/**
 * Authentication middleware for Express routes.
 * Validates portal ID and verifies the portal has a stored OAuth token.
 *
 * Related files:
 *   - ../index.js: mounted on protected routes
 *   - ../models/oauth-token.js: token validation
 *   - ../models/settings.js: settings existence check
 */

const crypto = require('node:crypto');

/**
 * Middleware: require portal ID and verify it has a stored session.
 * Checks that the portal has either OAuth tokens or saved settings (for dev mode).
 * Sets req.portalId for downstream handlers.
 */
function requirePortalId(req, res, next) {
  const portalId = req.headers['x-portal-id'] || req.query.portalId || req.params.portalId;

  if (!portalId) {
    return res.status(400).json({ error: 'Portal ID is required' });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(portalId)) {
    return res.status(400).json({ error: 'Invalid portal ID format' });
  }

  // In production, verify access. Allow bootstrap endpoints (login, test-gateway, settings GET)
  // so the admin panel can configure the gateway for the first time.
  if (process.env.NODE_ENV === 'production') {
    const isBootstrap = req.path === '/login' || req.path === '/test-gateway' || req.path === '/sync' || (req.method === 'GET');
    if (!isBootstrap) {
      const oauthTokens = require('../models/oauth-token');
      const settings = require('../models/settings');
      const tokens = oauthTokens.getTokens(portalId);
      const savedSettings = settings.getSettings(portalId);
      if (!tokens && !savedSettings) {
        return res.status(401).json({ error: 'Authentication required' });
      }
    }
  }

  req.portalId = portalId;
  next();
}

/**
 * Middleware: verify HubSpot request signature (v3).
 * HubSpot signs workflow action callbacks with X-HubSpot-Signature-v3.
 * See: https://developers.hubspot.com/docs/api/webhooks#request-signatures
 *
 * In development mode, signature verification is skipped if CLIENT_SECRET is not set.
 */
function verifyHubSpotSignature(req, res, next) {
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  // Skip verification in dev if no secret configured
  if (!clientSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('HUBSPOT_CLIENT_SECRET not set in production, rejecting request');
      return res.status(401).json({ error: 'Authentication required' });
    }
    return next();
  }

  const signatureHeader = req.headers['x-hubspot-signature-v3'] || req.headers['x-hubspot-signature'];
  const timestamp = req.headers['x-hubspot-request-timestamp'];

  if (!signatureHeader) {
    // No signature header means request is not from HubSpot
    // Allow in dev for manual testing, reject in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return next();
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  if (timestamp) {
    const requestTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Request expired' });
    }
  }

  // v3 signature: HMAC SHA-256 of (method + url + body + timestamp)
  try {
    const rawBody = JSON.stringify(req.body);
    const sourceString = `POST${req.protocol}://${req.get('host')}${req.originalUrl}${rawBody}${timestamp || ''}`;
    const hash = crypto.createHmac('sha256', clientSecret).update(sourceString).digest('base64');

    if (hash === signatureHeader) {
      return next();
    }

    // Try v1 signature format as fallback: SHA-256 of (clientSecret + body)
    const v1Source = clientSecret + rawBody;
    const v1Hash = crypto.createHash('sha256').update(v1Source).digest('hex');
    if (v1Hash === signatureHeader) {
      return next();
    }

    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    // In dev, warn but allow
    console.warn('HubSpot signature mismatch (dev mode, allowing)');
    next();
  } catch (err) {
    console.error('Signature verification error:', err.message);
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  }
}

module.exports = { requirePortalId, verifyHubSpotSignature };
