/**
 * CRM Card: SMS Panel on contact records.
 * Shows gateway status, quick send form, and SMS history for the contact.
 *
 * Related files:
 *   - sms-panel-hsmeta.json: card configuration
 *   - ../../app.functions/get-sms-history.js: fetches SMS logs
 *   - ../../app.functions/send-sms.js: sends SMS from card
 *   - ../../app.functions/get-settings.js: fetches gateway status
 */

import { hubspot } from '@hubspot/ui-extensions';
import {
  Text,
  Button,
  Input,
  TextArea,
  Flex,
  Divider,
  Badge,
  Alert,
  EmptyState,
  LoadingSpinner
} from '@hubspot/ui-extensions';
import { useState, useEffect } from 'react';

// Main entry point
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <SmsPanel
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

interface SmsPanelProps {
  context: any;
  runServerless: (opts: { name: string; parameters?: Record<string, any> }) => Promise<any>;
  sendAlert: (alert: { type: string; message: string }) => void;
}

function SmsPanel({ context, runServerless, sendAlert }: SmsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [gateway, setGateway] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Load gateway status and SMS history on mount
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [settingsRes, historyRes] = await Promise.all([
        runServerless({ name: 'getSettings', parameters: {} }),
        runServerless({
          name: 'getSmsHistory',
          parameters: { contactId: String(context.crm.objectId) }
        })
      ]);

      if (settingsRes?.response) {
        setGateway(settingsRes.response);
      }
      if (historyRes?.response?.logs) {
        setHistory(historyRes.response.logs);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  }

  async function handleSend() {
    if (!phone || !message) {
      sendAlert({ type: 'warning', message: 'Phone number and message are required' });
      return;
    }

    setSending(true);
    try {
      const result = await runServerless({
        name: 'sendSms',
        parameters: {
          phone,
          message,
          contactId: String(context.crm.objectId)
        }
      });

      if (result?.response?.success) {
        sendAlert({ type: 'success', message: 'SMS sent successfully' });
        setMessage('');
        loadData(); // Refresh history
      } else {
        sendAlert({
          type: 'danger',
          message: result?.response?.error || 'Failed to send SMS'
        });
      }
    } catch (err) {
      sendAlert({ type: 'danger', message: 'Failed to send SMS' });
    }
    setSending(false);
  }

  if (loading) {
    return <LoadingSpinner label="Loading SMS panel..." />;
  }

  return (
    <Flex direction="column" gap="medium">
      {/* Gateway Status Bar */}
      <Flex direction="row" gap="small" align="center">
        <Badge variant={gateway?.connected ? 'success' : 'danger'}>
          {gateway?.connected ? 'Connected' : 'Disconnected'}
        </Badge>
        {gateway?.testMode && (
          <Badge variant="warning">Test Mode</Badge>
        )}
        {gateway?.connected && (
          <Text format={{ fontWeight: 'bold' }}>
            Balance: {gateway?.balance ?? 0}
          </Text>
        )}
      </Flex>

      <Divider />

      {/* Quick Send Form */}
      {gateway?.connected && gateway?.enabled ? (
        <Flex direction="column" gap="small">
          <Text format={{ fontWeight: 'bold' }}>Quick Send SMS</Text>
          <Input
            label="Phone Number"
            name="phone"
            value={phone}
            onChange={(val: string) => setPhone(val)}
            placeholder="96598765432"
          />
          <TextArea
            label="Message"
            name="message"
            value={message}
            onChange={(val: string) => setMessage(val)}
            placeholder="Enter your SMS message..."
          />
          <Text variant="microcopy">
            Sender: {gateway?.senderId || 'KWT-SMS'}
          </Text>
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={sending || !phone || !message}
          >
            {sending ? 'Sending...' : 'Send SMS'}
          </Button>
        </Flex>
      ) : (
        <Alert title="Gateway not ready" variant="warning">
          {!gateway?.connected
            ? 'Configure your kwtSMS credentials in the app settings.'
            : 'The SMS gateway is currently disabled.'}
        </Alert>
      )}

      <Divider />

      {/* SMS History */}
      <Text format={{ fontWeight: 'bold' }}>SMS History</Text>
      {history.length === 0 ? (
        <EmptyState title="No messages yet" layout="vertical">
          <Text>SMS messages sent to this contact will appear here.</Text>
        </EmptyState>
      ) : (
        <Flex direction="column" gap="extra-small">
          {history.map((log: any) => (
            <Flex
              key={log.id}
              direction="row"
              justify="between"
              align="center"
            >
              <Flex direction="column" gap="flush">
                <Text>
                  {log.message_text?.substring(0, 60)}
                  {log.message_text?.length > 60 ? '...' : ''}
                </Text>
                <Text variant="microcopy">
                  {new Date(log.created_at).toLocaleString()}
                </Text>
              </Flex>
              <Badge
                variant={
                  log.status === 'sent'
                    ? 'success'
                    : log.status === 'failed'
                    ? 'danger'
                    : 'default'
                }
              >
                {log.status}
              </Badge>
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
