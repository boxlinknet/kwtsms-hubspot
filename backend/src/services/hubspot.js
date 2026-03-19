/**
 * HubSpot API helper: fetches contact properties using @hubspot/api-client.
 * Supports OAuth tokens (production) and personal access keys (development).
 *
 * Related files:
 *   - ../models/oauth-token.js: stored OAuth tokens
 *   - ../routes/workflow-action.js: uses getContactProperty
 */

const { Client } = require('@hubspot/api-client');
const { getTokens } = require('../models/oauth-token');

/**
 * Get a HubSpot API client for a portal.
 * Uses stored OAuth token first, falls back to personal access key.
 *
 * @param {string} portalId
 * @returns {Client}
 */
function getHubSpotClient(portalId) {
  // Try OAuth token first (production)
  const tokens = getTokens(portalId);
  if (tokens && tokens.accessToken) {
    return new Client({ accessToken: tokens.accessToken });
  }

  // Fall back to personal access key from env
  if (process.env.HUBSPOT_ACCESS_KEY) {
    return new Client({ accessToken: process.env.HUBSPOT_ACCESS_KEY });
  }

  // Fall back to reading hubspot.config.yml personal access key
  try {
    const fs = require('fs');
    const path = require('path');
    const yaml = fs.readFileSync(
      path.join(__dirname, '../../..', 'hubspot.config.yml'), 'utf8'
    );
    const match = yaml.match(/personalAccessKey:\s*>-?\s*\n\s+(\S+)/);
    if (match) {
      return new Client({ accessToken: match[1] });
    }
  } catch (e) {
    // Config not found
  }

  throw new Error('No HubSpot access token available');
}

/**
 * Get a specific property value from a contact.
 *
 * @param {string} portalId
 * @param {string} contactId - HubSpot contact object ID
 * @param {string} propertyName - e.g., "mobilephone", "phone"
 * @returns {Promise<string|null>} property value or null
 */
async function getContactProperty(portalId, contactId, propertyName) {
  try {
    const client = getHubSpotClient(portalId);
    const response = await client.crm.contacts.basicApi.getById(
      contactId,
      [propertyName]
    );
    return response.properties?.[propertyName] || null;
  } catch (err) {
    console.error(`Failed to fetch contact ${contactId} property ${propertyName}: ${err.message}`);
    return null;
  }
}

module.exports = { getHubSpotClient, getContactProperty };
