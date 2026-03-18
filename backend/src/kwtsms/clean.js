/**
 * Message text cleaning and info utilities.
 * Re-exports official kwtsms-js cleanMessage and adds getMessageInfo()
 * for character/page count calculations.
 *
 * Related files:
 *   - normalize.js: phone number normalization
 *   - engine.js: send orchestrator that calls clean before send
 */

const { cleanMessage } = require('kwtsms');

// GSM 7-bit basic character set (standard single-byte chars)
const GSM_BASIC = new Set(
  '@\u00A3$\u00A5\u00E8\u00E9\u00F9\u00EC\u00F2\u00C7\n\u00D8\u00F8\r\u00C5\u00E5'
  + '\u0394_\u03A6\u0393\u039B\u03A9\u03A0\u03A8\u03A3\u0398\u039E\u00C6\u00E6'
  + '\u00DF\u00C9 !"#\u00A4%&\'()*+,-./0123456789:;<=>?'
  + '\u00A1ABCDEFGHIJKLMNOPQRSTUVWXYZ\u00C4\u00D6\u00D1\u00DC\u00A7'
  + '\u00BFabcdefghijklmnopqrstuvwxyz\u00E4\u00F6\u00F1\u00FC\u00E0'
);

// GSM 7-bit extension table (each takes 2 bytes)
const GSM_EXTENSION = new Set('|^{}[]~\\€\f');

/**
 * Check if a message contains only GSM 7-bit characters.
 * Any non-GSM character (Arabic, emoji remnants, etc.) forces Unicode encoding.
 * @param {string} text - cleaned message text
 * @returns {boolean}
 */
function isGsm7(text) {
  for (const char of text) {
    if (!GSM_BASIC.has(char) && !GSM_EXTENSION.has(char)) {
      return false;
    }
  }
  return true;
}

/**
 * Calculate message info: character count, page count, encoding type.
 * Accounts for GSM extension chars taking 2 bytes.
 *
 * @param {string} message - raw or cleaned message text
 * @returns {{ charCount: number, gsm7Length: number|null, pageCount: number, encoding: string, isArabic: boolean, maxPages: number }}
 */
function getMessageInfo(message) {
  const cleaned = cleanMessage(message);
  const gsm7 = isGsm7(cleaned);

  let charCount = cleaned.length;
  let gsm7Length = null;

  if (gsm7) {
    // GSM extension chars count as 2
    gsm7Length = 0;
    for (const char of cleaned) {
      gsm7Length += GSM_EXTENSION.has(char) ? 2 : 1;
    }
  }

  const encoding = gsm7 ? 'GSM-7' : 'UCS-2';
  const effectiveLength = gsm7 ? gsm7Length : charCount;

  // Page limits
  const singlePageMax = gsm7 ? 160 : 70;
  const multiPageMax = gsm7 ? 153 : 67;
  const maxPages = 7;

  let pageCount;
  if (effectiveLength === 0) {
    pageCount = 0;
  } else if (effectiveLength <= singlePageMax) {
    pageCount = 1;
  } else {
    pageCount = Math.ceil(effectiveLength / multiPageMax);
  }

  return {
    charCount,
    gsm7Length,
    pageCount: Math.min(pageCount, maxPages),
    encoding,
    isArabic: !gsm7,
    maxPages
  };
}

module.exports = {
  cleanMessage,
  getMessageInfo,
  isGsm7
};
