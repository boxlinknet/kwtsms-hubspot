/**
 * Express application entry point for kwtSMS HubSpot backend.
 * Initializes database, middleware, routes, and scheduled jobs.
 *
 * Related files:
 *   - ./config/database.js: SQLite initialization
 *   - ./middleware/*.js: request processing
 *   - ./routes/*.js: API endpoints
 *   - ./jobs/daily-sync.js: scheduled sync
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { getDatabase } = require('./config/database');
const { sanitizeMiddleware } = require('./middleware/sanitize');
const { requirePortalId } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error-handler');
const { startDailySync } = require('./jobs/daily-sync');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database (runs migrations)
getDatabase();

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(sanitizeMiddleware);

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OAuth routes (no portal auth required, handled by OAuth flow)
app.use('/api/oauth', require('./routes/oauth'));

// Workflow action route (auth comes from HubSpot payload, not our middleware)
app.use('/api/workflow-action', require('./routes/workflow-action'));

// Protected routes (portal ID in URL path)
app.use('/api/settings/:portalId', requirePortalId, require('./routes/settings'));
app.use('/api/dashboard/:portalId', requirePortalId, require('./routes/dashboard'));
app.use('/api/logs/:portalId', requirePortalId, require('./routes/logs'));

// SMS routes (portal ID from header)
app.use('/api/sms', requirePortalId, require('./routes/sms'));

// Global error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`kwtSMS HubSpot backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start daily sync job
  startDailySync();
});

module.exports = app;
