# Security Policy

## Reporting a vulnerability

Do not disclose security vulnerabilities in public issues. Report them privately to the repository owner with enough detail to reproduce the issue and, where possible, the affected file/route and impact.

## Production security baseline

- Secrets and API keys must remain server-side and must never be committed to the repository.
- Authentication is not authorization: every backend data operation must independently enforce ownership/role checks.
- Diagnostic output must distinguish observed evidence from AI inference and must not invent vehicle data, test results, TSBs, parts, or confidence values.
- External AI and automotive-data calls must be validated, bounded, rate-limited, and treated as untrusted input/output.
- User-provided vehicle and diagnostic fields must be schema-validated before persistence or external calls.
- Production builds must run dependency and secret scanning in CI.
- Security-sensitive changes must be reviewed before deployment.
