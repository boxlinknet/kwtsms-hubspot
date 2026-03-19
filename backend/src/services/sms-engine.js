/**
 * SMS Send Engine: the core orchestrator that ties together normalization,
 * validation, cleaning, balance checking, coverage checking, and sending.
 *
 * All send operations flow through this module. It enforces:
 *   - Global gateway enabled/disabled check
 *   - Gateway configured check (credentials exist)
 *   - Test mode flag
 *   - Phone normalization and local verification
 *   - Country coverage pre-check
 *   - Duplicate removal
 *   - Message cleaning
 *   - Balance pre-check (zero = no API call)
 *   - Logging of every action
 *
 * Related files:
 *   - ../kwtsms/verify.js: phone verification and coverage checks
 *   - ../kwtsms/clean.js: message cleaning and page count
 *   - ../kwtsms/errors.js: error classification
 *   - ../models/settings.js: gateway configuration
 *   - ../models/sms-log.js: send history storage
 *   - logger.js: activity logging
 */

const { KwtSMS } = require('kwtsms');
const { verifyPhone, checkCoverage, deduplicateNumbers } = require('../kwtsms/verify');
const { cleanMessage, getMessageInfo } = require('../kwtsms/clean');
const { getErrorInfo, isBalanceError, isCriticalError } = require('../kwtsms/errors');
const { getSettings, updateBalance, upsertSettings, updateSenderIds, updateCoverage } = require('../models/settings');
const smsLog = require('../models/sms-log');
const { createLogger } = require('./logger');

/**
 * Send SMS to one or more recipients through the full validation pipeline.
 *
 * @param {string} portalId - HubSpot portal ID
 * @param {string|string[]} recipients - phone number(s)
 * @param {string} message - SMS message text
 * @param {string} [senderId] - override sender ID (uses settings default if omitted)
 * @param {object} [options]
 * @param {string} [options.source='manual'] - source identifier (workflow_action, crm_card, admin_panel)
 * @param {string} [options.contactId] - HubSpot contact ID for log association
 * @returns {Promise<object>} result summary
 */
async function send(portalId, recipients, message, senderId, options = {}) {
  const settings = getSettings(portalId);
  const logger = createLogger(portalId, settings?.debug_logging);
  const source = options.source || 'manual';
  const contactId = options.contactId || null;

  // 1. Check gateway enabled
  if (!settings) {
    logger.error('sms-engine.send', 'Gateway not configured: no settings found');
    return { success: false, error: 'Gateway not configured', skippedAll: true };
  }

  if (!settings.gateway_enabled) {
    logger.info('sms-engine.send', 'Send skipped: gateway is disabled');
    return { success: false, error: 'Gateway is disabled', skippedAll: true };
  }

  // 2. Check credentials exist
  if (!settings.kwtsms_username || !settings.kwtsms_password) {
    logger.error('sms-engine.send', 'Send blocked: gateway credentials not configured');
    return { success: false, error: 'Gateway credentials not configured', skippedAll: true };
  }

  // 3. Normalize recipients to array
  const rawNumbers = Array.isArray(recipients) ? recipients : [recipients];
  logger.debug('sms-engine.send', `Processing ${rawNumbers.length} recipient(s)`, { source });

  // 4. Verify each phone number locally
  const verified = [];
  const rejected = [];

  for (const raw of rawNumbers) {
    const result = verifyPhone(raw);
    if (result.valid) {
      verified.push(result);
    } else {
      rejected.push({ phone: raw, reason: result.reason });
      logger.info('sms-engine.send', `Rejected invalid number: ${result.reason}`, { phone: raw });
    }
  }

  // 5. Check coverage for each valid number
  const covered = [];
  for (const v of verified) {
    const cov = checkCoverage(v.normalized, settings.coverage);
    if (cov.covered) {
      covered.push(v);
    } else {
      rejected.push({ phone: v.normalized, reason: cov.reason });
      logger.info('sms-engine.send', `Skipped uncovered country: ${cov.reason}`, {
        phone: v.normalized,
        countryCode: cov.countryCode
      });
    }
  }

  // 6. Deduplicate
  const { unique, duplicateCount } = deduplicateNumbers(covered.map(v => v.normalized));
  if (duplicateCount > 0) {
    logger.debug('sms-engine.send', `Removed ${duplicateCount} duplicate number(s)`);
  }

  // 7. Check if any recipients remain
  if (unique.length === 0) {
    logger.info('sms-engine.send', 'No valid recipients after filtering', {
      totalInput: rawNumbers.length,
      rejected: rejected.length
    });
    return {
      success: false,
      error: 'No valid recipients after filtering',
      rejected,
      sent: 0,
      skippedAll: true
    };
  }

  // 8. Clean message
  const cleaned = cleanMessage(message);
  const msgInfo = getMessageInfo(cleaned);

  if (cleaned.length === 0) {
    logger.error('sms-engine.send', 'Message is empty after cleaning');
    return { success: false, error: 'Message is empty after cleaning', skippedAll: true };
  }

  if (msgInfo.pageCount > msgInfo.maxPages) {
    logger.error('sms-engine.send', `Message too long: ${msgInfo.pageCount} pages (max ${msgInfo.maxPages})`);
    return { success: false, error: 'Message exceeds maximum length (7 pages)', skippedAll: true };
  }

  logger.debug('sms-engine.send', `Message: ${msgInfo.charCount} chars, ${msgInfo.pageCount} page(s), ${msgInfo.encoding}`);

  // 9. Check balance
  if (settings.balance <= 0) {
    logger.error('sms-engine.send', 'Send blocked: zero balance', { balance: settings.balance });

    // Log each number as skipped
    for (const phone of unique) {
      smsLog.createLog({
        hubspot_portal_id: portalId,
        hubspot_contact_id: contactId,
        recipient_phone: phone,
        message_text: cleaned,
        sender_id: senderId || settings.sender_id,
        source,
        test_mode: settings.test_mode,
        status: 'skipped',
        kwtsms_error_code: 'ERR010',
        kwtsms_error_desc: 'Zero balance - send blocked without API call'
      });
    }

    return { success: false, error: 'Zero balance', rejected, sent: 0, skippedAll: true };
  }

  // 10. Create kwtSMS client and send
  const sms = new KwtSMS(settings.kwtsms_username, settings.kwtsms_password, {
    senderId: senderId || settings.sender_id,
    testMode: settings.test_mode,
    logFile: '' // disable file logging, we use our own
  });

  logger.info('sms-engine.send', `Sending to ${unique.length} recipient(s)`, {
    source,
    testMode: settings.test_mode,
    senderId: senderId || settings.sender_id,
    pages: msgInfo.pageCount
  });

  const result = await sms.send(unique, cleaned);

  // 11. Process result and create log entries
  if (result.result === 'OK' || result.result === 'PARTIAL') {
    // Update cached balance from response
    const balanceAfter = result['balance-after'] ?? result['balance-after'];
    if (balanceAfter != null) {
      updateBalance(portalId, balanceAfter);
    }

    // Log successful send for each recipient
    for (const phone of unique) {
      smsLog.createLog({
        hubspot_portal_id: portalId,
        hubspot_contact_id: contactId,
        recipient_phone: phone,
        message_text: cleaned,
        sender_id: senderId || settings.sender_id,
        source,
        test_mode: settings.test_mode,
        status: 'sent',
        kwtsms_result: result.result,
        kwtsms_msg_id: result['msg-id'] || (result['msg-ids'] ? result['msg-ids'][0] : null),
        points_charged: result['points-charged'] || 0,
        balance_after: balanceAfter,
        api_response_raw: result
      });
    }

    logger.info('sms-engine.send', `Send completed: ${result.result}`, {
      msgId: result['msg-id'] || result['msg-ids'],
      numbers: result.numbers,
      pointsCharged: result['points-charged'],
      balanceAfter
    });

    return {
      success: true,
      result: result.result,
      msgId: result['msg-id'] || result['msg-ids'],
      sent: unique.length,
      pointsCharged: result['points-charged'] || 0,
      balanceAfter,
      rejected,
      duplicatesRemoved: duplicateCount
    };
  }

  // 12. Handle error response
  const errorInfo = getErrorInfo(result.code);

  // Update balance if it's a balance error
  if (isBalanceError(result.code)) {
    updateBalance(portalId, 0);
  }

  // Log failed send
  for (const phone of unique) {
    smsLog.createLog({
      hubspot_portal_id: portalId,
      hubspot_contact_id: contactId,
      recipient_phone: phone,
      message_text: cleaned,
      sender_id: senderId || settings.sender_id,
      source,
      test_mode: settings.test_mode,
      status: 'failed',
      kwtsms_result: 'ERROR',
      kwtsms_error_code: result.code,
      kwtsms_error_desc: result.description,
      api_response_raw: result
    });
  }

  logger.error('sms-engine.send', `Send failed: ${result.code} - ${result.description}`, {
    errorInfo,
    recipients: unique.length
  });

  return {
    success: false,
    error: result.description,
    errorCode: result.code,
    errorInfo,
    sent: 0,
    rejected,
    duplicatesRemoved: duplicateCount
  };
}

/**
 * Test gateway connection by calling /balance/ with provided credentials.
 * Does NOT save credentials. Used for the "Test Connection" button.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ success: boolean, balance?: number, error?: string }>}
 */
async function testGateway(username, password) {
  const sms = new KwtSMS(username, password, { testMode: true, logFile: '' });
  const [ok, balance, err] = await sms.verify();

  if (ok) {
    return { success: true, balance };
  }
  return { success: false, error: err || 'Connection failed' };
}

/**
 * Login: validate credentials, save them, fetch senderids + coverage.
 * Called when user enters credentials in settings and clicks "Save".
 *
 * @param {string} portalId
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ success: boolean, balance?: number, senderIds?: string[], error?: string }>}
 */
async function loginAndSync(portalId, username, password) {
  const sms = new KwtSMS(username, password, { testMode: true, logFile: '' });

  // Verify credentials
  const [ok, balance, err] = await sms.verify();
  if (!ok) {
    return { success: false, error: err || 'Invalid credentials' };
  }

  // Fetch sender IDs
  const senderResult = await sms.senderids();
  const senderIds = senderResult.result === 'OK' ? senderResult.senderids : [];

  // Fetch coverage
  const coverageResult = await sms.coverage();
  const coverage = coverageResult.result === 'OK' ? (coverageResult.prefixes || coverageResult.coverage || []) : [];

  // Save everything
  upsertSettings(portalId, {
    kwtsms_username: username,
    kwtsms_password: password,
    balance,
    available_sender_ids: senderIds,
    coverage,
    last_sync: new Date().toISOString()
  });

  const logger = createLogger(portalId);
  logger.info('sms-engine.loginAndSync', 'Gateway connected successfully', {
    balance,
    senderIds: senderIds.length,
    coverage: coverage.length
  });

  return { success: true, balance, senderIds, coverage };
}

module.exports = { send, testGateway, loginAndSync };
