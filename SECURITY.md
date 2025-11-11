# Security Policy

## Supported Versions

We actively support the following versions of SVGER-CLI with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

We take the security of SVGER-CLI seriously. If you discover a security vulnerability, please follow these guidelines:

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Send an email to **faezemohades@gmail.com** with the subject line: `[SECURITY] SVGER-CLI Vulnerability Report`
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if any)
   - Your contact information

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 24 hours
- **Assessment**: We will assess the vulnerability within 72 hours
- **Updates**: We will provide regular updates on our progress
- **Resolution**: Critical vulnerabilities will be patched within 7 days, others within 30 days

### Security Best Practices for Users

When using SVGER-CLI in your projects:

1. **Keep Updated**: Always use the latest version
2. **Validate Input**: Ensure SVG files come from trusted sources
3. **Review Output**: Inspect generated components before deploying
4. **File Permissions**: Use appropriate file permissions for generated components
5. **CI/CD Security**: Secure your build pipelines that use SVGER-CLI

### Security Features

SVGER-CLI includes several security features:

- **Zero Dependencies**: Eliminates third-party vulnerability vectors
- **Input Validation**: Validates SVG content before processing
- **Sandboxed Processing**: Processes files in isolated contexts
- **Safe Output Generation**: Generates safe, sanitized component code
- **File Locking**: Prevents unauthorized modification of protected files

### Disclosure Policy

- We believe in responsible disclosure
- We will credit security researchers who report vulnerabilities responsibly
- We may create a security advisory for significant vulnerabilities
- We will notify users through our release notes and GitHub security advisories

## Contact

For any security-related questions or concerns:

- **Primary Contact**: faezemohades@gmail.com
- **Alternative Contact**: navidrezadoost07@gmail.com
- **PGP Key**: Available upon request

Thank you for helping keep SVGER-CLI secure!