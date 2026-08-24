# Production certification runbook

This gate separates code readiness from real-world certification.

## Required before production claim

1. `npm run build` passes with security, diagnostic, adversarial, shop-security and production gates.
2. Production deployment uses a non-local Convex deployment and authenticated users only.
3. Authentication smoke test: sign-up/sign-in/sign-out and protected route access.
4. Organization isolation test: user A cannot read/write user B's organization data.
5. Role test: viewer cannot write; technician cannot bill/manage members; advisor cannot manage organization settings.
6. Repair-order authorization test: estimate cannot advance without recorded customer authorization.
7. Payment reconciliation test: client cannot mark an invoice paid.
8. Upload test: expired/foreign claims are rejected and destructive operations are audited.
9. Diagnostic adversarial suite passes.
10. OBD safety test confirms no AI path can clear DTCs, program ECUs, bypass interlocks or issue autonomous actuator commands.
11. Real-vehicle validation: at least one controlled known-fault vehicle per supported diagnostic family, with independent ground truth and saved evidence.
12. Bluetooth disconnect/reconnect and malformed-frame tests pass on the actual supported adapter matrix.
13. Backup/restore and incident-response procedures are exercised.

A green code build is necessary but not sufficient for a production safety claim. Physical-vehicle validation must be performed by a qualified technician and documented before enabling diagnostic decisions for paying customers.