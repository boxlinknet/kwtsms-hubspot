# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Email:** support@kwtsms.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Security Practices

- API credentials are encrypted at rest using AES-256-GCM
- All kwtSMS API communication uses HTTPS POST only
- Credentials are never written to logs at any log level
- Input sanitization on all user-facing endpoints (XSS, SQL injection prevention)
- Parameterized database queries throughout
- Generic error messages to prevent information disclosure
- OAuth tokens stored with encryption and automatic refresh
- No sensitive data exposed to frontend JavaScript

## Responsible Disclosure

We ask that you:
- Give us reasonable time to fix the issue before public disclosure
- Do not access or modify other users' data
- Do not degrade the service for other users
