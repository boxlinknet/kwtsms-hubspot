/**
 * Authentication middleware for Express routes.
 * Validates HubSpot portal ID from request headers.
 *
 * Related files:
 *   - ../index.js: mounted on protected routes
 *   - ../models/oauth-token.js: token validation
 */

/**
 * Middleware: require portal ID in X-Portal-Id header or query param.
 * Sets req.portalId for downstream handlers.
 */
function requirePortalId(req, res, next) {
  const portalId = req.headers['x-portal-id'] || req.query.portalId || req.params.portalId;

  if (!portalId) {
    return res.status(400).json({ error: 'Portal ID is required' });
  }

  // Basic validation: portal ID should be alphanumeric
  if (!/^[a-zA-Z0-9_-]+$/.test(portalId)) {
    return res.status(400).json({ error: 'Invalid portal ID format' });
  }

  req.portalId = portalId;
  next();
}

module.exports = { requirePortalId };
