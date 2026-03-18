/**
 * Global error handler middleware for Express.
 * Returns generic error messages to prevent information disclosure.
 * Logs full error details server-side.
 *
 * Related files:
 *   - ../index.js: mounted as last middleware
 */

/**
 * Express error handler. Must have 4 parameters for Express to recognize it.
 */
function errorHandler(err, req, res, _next) {
  // Log full error details server-side
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Determine status code
  const status = err.statusCode || err.status || 500;

  // Generic error messages to prevent enumeration
  const messages = {
    400: 'Invalid request',
    401: 'Authentication required',
    403: 'Access denied',
    404: 'Not found',
    429: 'Too many requests',
    500: 'Something went wrong'
  };

  res.status(status).json({
    error: messages[status] || 'Something went wrong'
  });
}

module.exports = { errorHandler };
