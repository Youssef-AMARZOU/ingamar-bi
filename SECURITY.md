# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

The INGAMAR BI team takes security seriously. We appreciate your efforts in responsibly disclosing your findings.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@ingamar.local**

You should receive a response within 48 hours. If for some reason you do not receive a response, please follow up via email to ensure we received your original message.

### What to Include

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full file paths or URLs of the affected source file(s)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Preferred Languages

We prefer all communications to be in English or French.

### Response Timeline

- **Initial Response**: Within 48 hours of receipt
- **Status Update**: Within 7 days of initial response
- **Resolution Target**: Within 30 days of confirmation

### Process

1. You submit your report
2. We acknowledge receipt and confirm the vulnerability
3. We work on a fix and coordinate a release
4. We disclose the vulnerability publicly (with credit to you, if desired)

## Security Best Practices

When deploying INGAMAR BI:

- Always use HTTPS in production
- Keep dependencies updated (`npm audit`, `pip-audit`)
- Use strong, unique passwords for admin accounts
- Enable rate limiting on API endpoints
- Regularly backup your database
- Review access logs periodically
- Use environment variables for sensitive configuration
- Never commit secrets or API keys to version control

## Security Features

INGAMAR BI includes several security features:

- JWT-based authentication with token rotation
- Role-based access control (RBAC)
- SQL injection prevention via parameterized queries
- XSS protection via Content Security Policy
- CORS configuration for API security
- Input validation and sanitization
- Secure password hashing (bcrypt)
- Rate limiting on authentication endpoints

## Known Security Limitations

- The application requires a trusted network environment
- File upload functionality should be restricted to trusted users
- SQL Lab access should be limited to authorized personnel
- API keys should be rotated regularly

## Acknowledgments

We would like to thank the following individuals for their responsible disclosure:

- [Your name here]

---

**Last Updated**: June 2026
