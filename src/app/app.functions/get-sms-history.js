/**
 * Serverless function: fetch SMS history for a contact from backend.
 *
 * Related files:
 *   - ../extensions/sms-panel/SmsPanel.tsx: calls this function
 *   - serverless.json: function registration
 */

exports.main = async (context = {}) => {
  const { contactId } = context.parameters || {};
  const backendUrl = context.secrets?.BACKEND_URL || 'http://localhost:3001';
  const portalId = String(context.portal?.id || 'default');

  try {
    const response = await fetch(
      `${backendUrl}/api/logs/${portalId}/sms/contact/${contactId}?limit=10`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const data = await response.json();
    return data;
  } catch (err) {
    return { logs: [], error: err.message };
  }
};
