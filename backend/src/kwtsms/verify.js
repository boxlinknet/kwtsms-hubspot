/**
 * Local phone number verification utilities.
 * Extends the official kwtsms-js validatePhoneInput with coverage
 * and duplicate checking for the send engine.
 *
 * Related files:
 *   - normalize.js: phone normalization (runs before verify)
 *   - engine.js: send orchestrator that calls verify in pipeline
 */

const {
  normalizePhone,
  validatePhoneInput,
  findCountryCode,
  COUNTRY_NAMES
} = require('kwtsms');

/**
 * Verify a single phone number locally. No API calls.
 * Normalizes first, then validates format and country rules.
 *
 * @param {string} phone - raw phone input
 * @returns {{ valid: boolean, normalized: string, reason?: string, countryCode?: string, countryName?: string }}
 */
function verifyPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, normalized: '', reason: 'Phone number is required' };
  }

  const [valid, error, normalized] = validatePhoneInput(phone);

  if (!valid) {
    return {
      valid: false,
      normalized: normalized || normalizePhone(phone),
      reason: error || 'Invalid phone number'
    };
  }

  const countryCode = findCountryCode(normalized);

  return {
    valid: true,
    normalized,
    countryCode: countryCode || undefined,
    countryName: countryCode ? COUNTRY_NAMES[countryCode] : undefined
  };
}

/**
 * Check if a phone number's country prefix is in the account's coverage list.
 *
 * @param {string} normalized - normalized phone number (digits only)
 * @param {string[]} coverageList - array of country codes from /API/coverage/
 * @returns {{ covered: boolean, countryCode?: string, countryName?: string, reason?: string }}
 */
function checkCoverage(normalized, coverageList) {
  if (!coverageList || coverageList.length === 0) {
    return { covered: true }; // no coverage data, allow send
  }

  const countryCode = findCountryCode(normalized);
  if (!countryCode) {
    return {
      covered: false,
      reason: 'Unable to detect country code from phone number'
    };
  }

  const covered = coverageList.includes(countryCode);
  return {
    covered,
    countryCode,
    countryName: COUNTRY_NAMES[countryCode],
    reason: covered ? undefined : `Country ${COUNTRY_NAMES[countryCode] || countryCode} (${countryCode}) is not in account coverage`
  };
}

/**
 * Deduplicate an array of normalized phone numbers.
 *
 * @param {string[]} numbers - array of normalized phone numbers
 * @returns {{ unique: string[], duplicateCount: number }}
 */
function deduplicateNumbers(numbers) {
  const seen = new Set();
  const unique = [];
  for (const num of numbers) {
    if (!seen.has(num)) {
      seen.add(num);
      unique.push(num);
    }
  }
  return {
    unique,
    duplicateCount: numbers.length - unique.length
  };
}

module.exports = {
  verifyPhone,
  checkCoverage,
  deduplicateNumbers
};
