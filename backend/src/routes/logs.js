/**
 * Logs API routes: SMS logs and activity log retrieval and cleanup.
 *
 * Related files:
 *   - ../models/sms-log.js: SMS log data
 *   - ../models/activity-log.js: activity log data
 */

const express = require('express');
const router = express.Router();
const smsLogModel = require('../models/sms-log');
const activityLogModel = require('../models/activity-log');

/**
 * GET /api/logs/:portalId/sms
 * Paginated SMS logs with optional filters.
 * Query: limit, offset, status, dateFrom, dateTo
 */
router.get('/:portalId/sms', (req, res) => {
  const { limit, offset, status, dateFrom, dateTo } = req.query;

  const logs = smsLogModel.getLogsByPortal(req.portalId, {
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });

  res.json({ logs, count: logs.length });
});

/**
 * GET /api/logs/:portalId/sms/contact/:contactId
 * SMS logs for a specific contact (used by CRM card).
 */
router.get('/:portalId/sms/contact/:contactId', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const logs = smsLogModel.getLogsByContact(req.portalId, req.params.contactId, limit);
  res.json({ logs });
});

/**
 * DELETE /api/logs/:portalId/sms
 * Clear SMS logs. Optional query: beforeDate (ISO string).
 */
router.delete('/:portalId/sms', (req, res) => {
  const deleted = smsLogModel.clearLogs(req.portalId, req.query.beforeDate);
  res.json({ success: true, deleted });
});

/**
 * GET /api/logs/:portalId/activity
 * Paginated activity logs with optional level filter.
 * Query: limit, offset, level
 */
router.get('/:portalId/activity', (req, res) => {
  const { limit, offset, level } = req.query;

  const logs = activityLogModel.getLogs(req.portalId, {
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    level: level || undefined
  });

  res.json({ logs, count: logs.length });
});

/**
 * DELETE /api/logs/:portalId/activity
 * Clear activity logs. Optional query: beforeDate.
 */
router.delete('/:portalId/activity', (req, res) => {
  const deleted = activityLogModel.clearLogs(req.portalId, req.query.beforeDate);
  res.json({ success: true, deleted });
});

module.exports = router;
