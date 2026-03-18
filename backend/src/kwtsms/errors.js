/**
 * kwtSMS error code mapping with severity levels and recommended actions.
 * Extends official kwtsms-js API_ERRORS with severity classification
 * for the admin dashboard and alerting system.
 *
 * Related files:
 *   - engine.js: uses severity to decide retry vs stop vs alert
 *   - ../services/logger.js: logs errors with severity context
 */

const { API_ERRORS } = require('kwtsms');

/**
 * Severity levels:
 *   critical - gateway broken, admin action required immediately
 *   high     - sends blocked, admin should be notified
 *   medium   - temporary issue, auto-retry may resolve
 *   low      - individual send skipped, logged for review
 */
const ERROR_SEVERITY = {
  ERR001: { severity: 'critical', action: 'contact_support', retryable: false },
  ERR002: { severity: 'high', action: 'check_integration', retryable: false },
  ERR003: { severity: 'critical', action: 'check_credentials', retryable: false },
  ERR004: { severity: 'critical', action: 'contact_support', retryable: false },
  ERR005: { severity: 'critical', action: 'contact_support', retryable: false },
  ERR006: { severity: 'low', action: 'check_phone_numbers', retryable: false },
  ERR007: { severity: 'low', action: 'reduce_batch_size', retryable: false },
  ERR008: { severity: 'high', action: 'check_sender_id', retryable: false },
  ERR009: { severity: 'low', action: 'check_message', retryable: false },
  ERR010: { severity: 'high', action: 'recharge_balance', retryable: false },
  ERR011: { severity: 'high', action: 'recharge_balance', retryable: false },
  ERR012: { severity: 'low', action: 'shorten_message', retryable: false },
  ERR013: { severity: 'medium', action: 'retry_with_backoff', retryable: true },
  ERR019: { severity: 'low', action: 'check_msg_id', retryable: false },
  ERR020: { severity: 'low', action: 'check_msg_id', retryable: false },
  ERR021: { severity: 'low', action: 'check_msg_id', retryable: false },
  ERR022: { severity: 'low', action: 'wait_and_retry', retryable: true },
  ERR023: { severity: 'low', action: 'contact_support', retryable: false },
  ERR024: { severity: 'critical', action: 'check_ip_whitelist', retryable: false },
  ERR025: { severity: 'low', action: 'normalize_phone', retryable: false },
  ERR026: { severity: 'low', action: 'activate_country', retryable: false },
  ERR027: { severity: 'low', action: 'strip_html', retryable: false },
  ERR028: { severity: 'medium', action: 'wait_15_seconds', retryable: true },
  ERR029: { severity: 'low', action: 'check_msg_id', retryable: false },
  ERR030: { severity: 'medium', action: 'delete_from_queue', retryable: false },
  ERR031: { severity: 'high', action: 'review_message_content', retryable: false },
  ERR032: { severity: 'high', action: 'review_message_content', retryable: false },
  ERR033: { severity: 'high', action: 'contact_support', retryable: false }
};

/**
 * Get enriched error info for a kwtSMS error code.
 *
 * @param {string} code - error code (e.g., "ERR003")
 * @returns {{ code: string, message: string, severity: string, action: string, retryable: boolean }}
 */
function getErrorInfo(code) {
  const severity = ERROR_SEVERITY[code] || { severity: 'low', action: 'check_logs', retryable: false };
  const message = API_ERRORS[code] || `Unknown error: ${code}`;

  return {
    code,
    message,
    severity: severity.severity,
    action: severity.action,
    retryable: severity.retryable
  };
}

/**
 * Check if an error code indicates the gateway is broken (needs admin attention).
 * @param {string} code
 * @returns {boolean}
 */
function isCriticalError(code) {
  const info = ERROR_SEVERITY[code];
  return info ? info.severity === 'critical' : false;
}

/**
 * Check if an error code indicates balance issues.
 * @param {string} code
 * @returns {boolean}
 */
function isBalanceError(code) {
  return code === 'ERR010' || code === 'ERR011';
}

module.exports = {
  ERROR_SEVERITY,
  getErrorInfo,
  isCriticalError,
  isBalanceError,
  API_ERRORS
};
