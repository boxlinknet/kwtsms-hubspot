/**
 * Workflow action route: handles HubSpot workflow POST callbacks.
 * This is the actionUrl that HubSpot calls when a "Send SMS" workflow step executes.
 * Protected by HubSpot signature verification.
 *
 * Related files:
 *   - ../services/sms-engine.js: send orchestrator
 *   - ../middleware/auth.js: HubSpot signature verification
 *   - ../services/hubspot.js: HubSpot API helper
 */

const express = require('express');
const router = express.Router();
const { send } = require('../services/sms-engine');
const { verifyHubSpotSignature } = require('../middleware/auth');
const { getContactProperty } = require('../services/hubspot');

// Apply HubSpot signature verification to all workflow action routes
router.use(verifyHubSpotSignature);

/**
 * POST /api/workflow-action/send-sms
 * Called by HubSpot when a workflow with "Send SMS via kwtSMS" action executes.
 *
 * HubSpot sends the selected property NAME (e.g., "mobilephone"), not the value.
 * We must fetch the actual phone number from the contact record via HubSpot API.
 */
router.post('/send-sms', async (req, res) => {
  try {
    const payload = req.body;

    // Extract portal ID from HubSpot payload
    const portalId = String(
      payload.origin?.portalId || payload.portalId || req.headers['x-portal-id'] || ''
    );

    if (!portalId) {
      return res.status(400).json({ error: 'Portal ID missing from workflow payload' });
    }

    // Extract input fields
    const inputFields = payload.inputFields || payload.fields || {};
    const message = inputFields.message || '';
    const senderId = inputFields.sender_name || inputFields.sender_id || undefined;

    // phone_number field uses OBJECT_PROPERTY - HubSpot resolves the actual value
    // phone_property is the old deprecated static field (property name)
    let phone = inputFields.phone_number || '';

    // Fallback: if phone_number is empty but phone_property has a value,
    // try to fetch from HubSpot API (backwards compatibility)
    if (!phone && inputFields.phone_property) {
      const contactId = String(payload.object?.objectId || '');
      if (contactId) {
        const value = await getContactProperty(portalId, contactId, inputFields.phone_property);
        if (value) phone = value;
      }
    }

    if (!phone) {
      return res.status(200).json({
        outputFields: { status: 'skipped', reason: 'No phone number provided' }
      });
    }

    if (!message) {
      return res.status(200).json({
        outputFields: { status: 'skipped', reason: 'No message provided' }
      });
    }

    // Extract contact ID from enrolled object
    const contactId = String(payload.object?.objectId || '');

    // Send SMS through the engine
    const result = await send(portalId, phone, message, senderId, {
      source: 'workflow_action',
      contactId
    });

    // Return result to HubSpot workflow
    res.status(200).json({
      outputFields: {
        status: result.success ? 'sent' : 'failed',
        msgId: result.msgId || '',
        error: result.error || '',
        pointsCharged: result.pointsCharged || 0
      }
    });
  } catch (err) {
    console.error('Workflow action error:', err.message);
    res.status(200).json({
      outputFields: { status: 'error', error: 'Internal error processing SMS' }
    });
  }
});

module.exports = router;
