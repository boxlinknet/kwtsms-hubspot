/**
 * Serverless function: send SMS to a contact via backend.
 *
 * Related files:
 *   - ../extensions/sms-panel/SmsPanel.tsx: calls this function
 *   - serverless.json: function registration
 */

exports.main = async (context = {}) => {
  const { phone, message, contactId } = context.parameters || {};
  const backendUrl = context.secrets?.BACKEND_URL || 'http://localhost:3001';
  const portalId = String(context.portal?.id || 'default');

  if (!phone || !message) {
    return { success: false, error: 'Phone and message are required' };
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/sms/send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Portal-Id': portalId
        },
        body: JSON.stringify({ phone, message, contactId, source: 'crm_card' })
      }
    );

    const data = await response.json();
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
};
