/**
 * Phone number normalization - re-exports official kwtsms-js normalize
 * with additional getMessageInfo() utility.
 *
 * Related files:
 *   - verify.js: local phone validation (runs after normalization)
 *   - clean.js: message text cleaning
 *   - engine.js: send orchestrator that uses all utilities
 */

const {
  normalizePhone,
  validatePhoneInput,
  validatePhoneFormat,
  findCountryCode,
  maskPhone,
  PHONE_RULES,
  COUNTRY_NAMES
} = require('kwtsms');

module.exports = {
  normalizePhone,
  validatePhoneInput,
  validatePhoneFormat,
  findCountryCode,
  maskPhone,
  PHONE_RULES,
  COUNTRY_NAMES
};
