/**
 * Workflow action route: handles HubSpot workflow POST callbacks.
 * This is the actionUrl that HubSpot calls when a "Send SMS" workflow step executes.
 * Protected by HubSpot signature verification.
 *
 * Related files:
 *   - ../services/sms-engine.js: send orchestrator
 *   - ../middleware/auth.js: HubSpot signature verification
 *   - ../../src/app/workflow-actions/workflow-actions-hsmeta.json: action definition
 */

const express = require('express');
const router = express.Router();
const { send } = require('../services/sms-engine');
const { verifyHubSpotSignature } = require('../middleware/auth');

// Apply HubSpot signature verification to all workflow action routes
router.use(verifyHubSpotSignature);

/**
 * POST /api/workflow-action/send-sms
 * Called by HubSpot when a workflow with "Send SMS via kwtSMS" action executes.
 *
 * HubSpot sends a payload with:
 *   - callbackId: unique execution ID
 *   - origin.portalId: HubSpot account ID
 *   - object.objectId: enrolled CRM object ID (e.g., contact ID)
 *   - inputFields: user-configured fields (phone_property, message, sender_id)
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
    const phone = inputFields.phone_property || inputFields.phone || '';
    const message = inputFields.message || '';
    const senderId = inputFields.sender_id || undefined;

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
