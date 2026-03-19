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
const path = require('node:path');
const helmet = require('helmet');
const cors = require('cors');
const { initDatabase } = require('./config/database');
const { sanitizeMiddleware } = require('./middleware/sanitize');
const { requirePortalId } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error-handler');
const { startDailySync } = require('./jobs/daily-sync');

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// CORS: restrict to known origins
const allowedOrigins = [
  BASE_URL,
  'https://app.hubspot.com',
  'https://app-eu1.hubspot.com'
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3001', 'http://localhost:3000');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    callback(null, false);
  },
  credentials: true
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "https://www.kwtsms.com"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"]
    }
  }
}));

app.use(express.json({ limit: '1mb' }));
app.use(sanitizeMiddleware);

// Serve admin UI
app.use('/admin', express.static(path.join(__dirname, 'public')));

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OAuth routes (no portal auth required, handled by OAuth flow)
app.use('/api/oauth', require('./routes/oauth'));

// Workflow action route (auth via HubSpot signature verification)
app.use('/api/workflow-action', require('./routes/workflow-action'));

// Protected routes (portal ID in URL path, OAuth token check in production)
app.use('/api/settings/:portalId', requirePortalId, require('./routes/settings'));
app.use('/api/dashboard/:portalId', requirePortalId, require('./routes/dashboard'));
app.use('/api/logs/:portalId', requirePortalId, require('./routes/logs'));

// SMS routes (portal ID from header)
app.use('/api/sms', requirePortalId, require('./routes/sms'));

// Global error handler (must be last)
app.use(errorHandler);

// Initialize database (async) then start server
async function start() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`kwtSMS HubSpot backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    startDailySync();
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

module.exports = app;
