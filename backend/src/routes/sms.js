/**
 * SMS routes: manual send and test endpoints.
 *
 * Related files:
 *   - ../services/sms-engine.js: send orchestrator
 *   - ../middleware/auth.js: portal ID validation
 */

const express = require('express');
const router = express.Router();
const { send } = require('../services/sms-engine');
const { getSettings } = require('../models/settings');

/**
 * POST /api/sms/send
 * Manual send from admin panel or CRM card.
 * Body: { phone, message, senderId?, contactId?, source? }
 */
router.post('/send', async (req, res, next) => {
  try {
    const { phone, message, senderId, contactId, source } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await send(req.portalId, phone, message, senderId, {
      source: source || 'manual',
      contactId
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sms/test
 * Send a test message (always with test=1 regardless of settings).
 * Body: { phone, message }
 */
router.post('/test', async (req, res, next) => {
  try {
    const { phone, message } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const settings = getSettings(req.portalId);
    if (!settings || !settings.kwtsms_username) {
      return res.status(400).json({ error: 'Gateway not configured' });
    }

    const { KwtSMS } = require('kwtsms');
    const { cleanMessage } = require('../kwtsms/clean');
    const { verifyPhone } = require('../kwtsms/verify');

    const verification = verifyPhone(phone);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.reason });
    }

    const sms = new KwtSMS(settings.kwtsms_username, settings.kwtsms_password, {
      senderId: settings.sender_id,
      testMode: true,
      logFile: ''
    });

    const cleaned = cleanMessage(message || 'kwtSMS HubSpot integration test message');
    const result = await sms.send(verification.normalized, cleaned);

    res.json({
      success: result.result === 'OK',
      testMode: true,
      result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
