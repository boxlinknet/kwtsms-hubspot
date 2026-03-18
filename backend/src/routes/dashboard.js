/**
 * Dashboard API route: returns gateway status and SMS statistics.
 *
 * Related files:
 *   - ../models/settings.js: gateway configuration
 *   - ../models/sms-log.js: send statistics
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const { getSettingsMasked } = require('../models/settings');
const { getStats, getLogsByPortal } = require('../models/sms-log');

/**
 * GET /api/dashboard/:portalId
 * Returns dashboard data: gateway status, balance, SMS stats, recent activity.
 */
router.get('/', (req, res) => {
  const settings = getSettingsMasked(req.portalId);

  const statsToday = getStats(req.portalId, 'today');
  const statsWeek = getStats(req.portalId, 'week');
  const statsMonth = getStats(req.portalId, 'month');
  const recentActivity = getLogsByPortal(req.portalId, { limit: 10 });

  res.json({
    gateway: {
      connected: Boolean(settings && settings.kwtsms_username !== ''),
      enabled: settings?.gateway_enabled || false,
      testMode: settings?.test_mode || true,
      balance: settings?.balance || 0,
      senderId: settings?.sender_id || 'KWT-SMS',
      availableSenderIds: settings?.available_sender_ids || [],
      lastSync: settings?.last_sync || null
    },
    stats: {
      today: statsToday,
      week: statsWeek,
      month: statsMonth
    },
    recentActivity: recentActivity.map(log => ({
      id: log.id,
      phone: log.recipient_phone,
      status: log.status,
      source: log.source,
      testMode: Boolean(log.test_mode),
      createdAt: log.created_at
    }))
  });
});

module.exports = router;
