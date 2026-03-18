/**
 * Serverless function: fetch gateway settings from backend.
 *
 * Related files:
 *   - ../extensions/sms-panel/SmsPanel.tsx: calls this function
 *   - serverless.json: function registration
 */

exports.main = async (context = {}) => {
  const backendUrl = context.secrets?.BACKEND_URL || 'http://localhost:3001';
  const portalId = String(context.portal?.id || 'default');

  try {
    const response = await fetch(
      `${backendUrl}/api/dashboard/${portalId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const data = await response.json();
    return data.gateway || {};
  } catch (err) {
    return { connected: false, error: err.message };
  }
};
