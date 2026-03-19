/**
 * Settings API routes: gateway configuration CRUD.
 *
 * Related files:
 *   - ../models/settings.js: data access
 *   - ../services/sms-engine.js: testGateway, loginAndSync
 *   - ../middleware/auth.js: portal ID validation
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const { getSettingsMasked, upsertSettings } = require('../models/settings');
const { testGateway, loginAndSync } = require('../services/sms-engine');

/**
 * GET /api/settings/:portalId
 * Returns settings with credentials masked.
 */
router.get('/', (req, res) => {
  const settings = getSettingsMasked(req.portalId);
  if (!settings) {
    return res.json({
      gateway_enabled: false,
      test_mode: true,
      debug_logging: false,
      balance: 0,
      sender_id: 'KWT-SMS',
      available_sender_ids: [],
      coverage: []
    });
  }
  res.json(settings);
});

/**
 * POST /api/settings/:portalId
 * Update settings (excluding credentials, use /login for that).
 */
router.post('/', (req, res) => {
  const allowed = ['sender_id', 'gateway_enabled', 'test_mode', 'debug_logging', 'default_country_code'];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      data[key] = req.body[key];
    }
  }

  const updated = upsertSettings(req.portalId, data);
  res.json({
    success: true,
    settings: {
      ...updated,
      kwtsms_username: updated.kwtsms_username ? '****' : '',
      kwtsms_password: updated.kwtsms_password ? '****' : ''
    }
  });
});

/**
 * POST /api/settings/:portalId/test-gateway
 * Test kwtSMS connection with provided credentials. Does NOT save.
 */
router.post('/test-gateway', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const result = await testGateway(username, password);
  if (result.success) {
    res.json({ success: true, balance: result.balance });
  } else {
    res.status(400).json({ success: false, error: 'Invalid credentials' });
  }
});

/**
 * POST /api/settings/:portalId/login
 * Validate credentials, save them, sync senderids + coverage.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const result = await loginAndSync(req.portalId, username, password);
  if (result.success) {
    res.json({
      success: true,
      balance: result.balance,
      senderIds: result.senderIds,
      coverage: result.coverage
    });
  } else {
    res.status(400).json({ success: false, error: 'Invalid credentials' });
  }
});

/**
 * POST /api/settings/:portalId/sync
 * Reload balance, sender IDs, and coverage using stored credentials.
 */
router.post('/sync', async (req, res) => {
  const settings = require('../models/settings').getSettings(req.portalId);
  if (!settings || !settings.kwtsms_username) {
    return res.status(400).json({ error: 'Gateway not configured' });
  }

  const result = await loginAndSync(req.portalId, settings.kwtsms_username, settings.kwtsms_password);
  if (result.success) {
    res.json({
      success: true,
      balance: result.balance,
      senderIds: result.senderIds,
      coverage: result.coverage
    });
  } else {
    res.status(400).json({ success: false, error: 'Sync failed' });
  }
});

/**
 * POST /api/settings/:portalId/logout
 * Clear gateway credentials and disable gateway.
 */
router.post('/logout', (req, res) => {
  upsertSettings(req.portalId, {
    kwtsms_username: '',
    kwtsms_password: '',
    gateway_enabled: false,
    balance: 0,
    available_sender_ids: [],
    coverage: []
  });
  res.json({ success: true });
});

module.exports = router;
