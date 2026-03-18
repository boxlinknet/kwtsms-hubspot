# kwtSMS for HubSpot

SMS notifications for HubSpot CRM powered by [kwtSMS](https://www.kwtsms.com) gateway.

Send one-way A2P SMS messages to your HubSpot contacts when CRM events occur, such as deal stage changes, new contacts, or ticket updates.

## Features

- **Workflow Action**: "Send SMS via kwtSMS" action in HubSpot's workflow builder
- **CRM Card**: SMS panel on contact records with quick send and message history
- **Gateway Settings**: Configure kwtSMS credentials with connection testing
- **Phone Normalization**: Handles all input formats including Arabic digits, country prefixes, spaces, dashes
- **Message Cleaning**: Strips emojis, hidden characters, and HTML before sending
- **SMS Logging**: Full delivery logs with API response tracking
- **Balance Monitoring**: Dashboard with real-time balance and send statistics
- **Test Mode**: Send test messages without delivery or credit consumption
- **Multilingual**: English and Arabic workflow labels and SMS content support
- **Daily Sync**: Automatic balance, sender ID, and coverage synchronization

## Requirements

- HubSpot CRM account (any tier)
- kwtSMS account with API access ([Sign up](https://www.kwtsms.com))
- A registered Sender ID on your kwtSMS account

## Installation

1. Install from the [HubSpot Marketplace](https://ecosystem.hubspot.com/marketplace/apps)
2. Authorize the app with your HubSpot account
3. Go to Settings and enter your kwtSMS API credentials
4. Click "Test Connection" to verify
5. Select your Sender ID
6. Create a workflow and add the "Send SMS via kwtSMS" action

## Configuration

### Gateway Setup

1. Log into your kwtSMS account at [kwtsms.com](https://www.kwtsms.com)
2. Navigate to API settings to get your API username and password
3. In the kwtSMS HubSpot app settings, enter these credentials
4. Test the connection to verify

### Sender ID

Your Sender ID must be pre-approved by kwtSMS before use in production.
The default `KWT-SMS` sender is for testing only and should not be used in production.

To register a Sender ID, visit [kwtsms.com/sender-id-help.html](https://www.kwtsms.com/sender-id-help.html).

## Support

- Email: support@kwtsms.com
- Support Center: [kwtsms.com/support.html](https://www.kwtsms.com/support.html)
- FAQ: [kwtsms.com/faq_all.php](https://www.kwtsms.com/faq_all.php)
- Developer Docs: [kwtsms.com/developers.html](https://www.kwtsms.com/developers.html)

## License

MIT
