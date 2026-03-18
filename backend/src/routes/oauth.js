/**
 * HubSpot OAuth 2.0 flow handlers.
 * Handles app installation authorization and token management.
 *
 * Related files:
 *   - ../models/oauth-token.js: token storage
 *   - ../middleware/auth.js: token validation
 */

const express = require('express');
const router = express.Router();

const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3001/api/oauth/callback';
const SCOPES = [
  'oauth',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read'
].join(' ');

/**
 * GET /api/oauth/install
 * Redirects to HubSpot OAuth authorization page.
 */
router.get('/install', (req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).json({ error: 'OAuth not configured' });
  }

  const authUrl = `https://app.hubspot.com/oauth/authorize`
    + `?client_id=${encodeURIComponent(CLIENT_ID)}`
    + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    + `&scope=${encodeURIComponent(SCOPES)}`;

  res.redirect(authUrl);
});

/**
 * GET /api/oauth/callback
 * Handles OAuth authorization code exchange for tokens.
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code missing' });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ error: 'OAuth not configured' });
  }

  try {
    const { Client } = require('@hubspot/api-client');
    const hubspotClient = new Client();

    const tokenResponse = await hubspotClient.oauth.tokensApi.create(
      'authorization_code',
      code,
      REDIRECT_URI,
      CLIENT_ID,
      CLIENT_SECRET
    );

    // Get portal ID from access token info
    const tokenInfo = await hubspotClient.oauth.accessTokensApi.get(tokenResponse.accessToken);
    const portalId = String(tokenInfo.hubId);

    // Save tokens
    const oauthTokens = require('../models/oauth-token');
    const expiresAt = new Date(Date.now() + tokenResponse.expiresIn * 1000).toISOString();
    oauthTokens.saveTokens(portalId, tokenResponse.accessToken, tokenResponse.refreshToken, expiresAt);

    // Initialize settings for this portal if not exist
    const settings = require('../models/settings');
    const existing = settings.getSettings(portalId);
    if (!existing) {
      settings.upsertSettings(portalId, { test_mode: true });
    }

    // Redirect to app settings page
    res.redirect(`https://app.hubspot.com/integrations-settings/${portalId}/installed`);
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
