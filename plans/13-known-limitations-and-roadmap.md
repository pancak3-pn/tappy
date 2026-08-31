# Known Limitations and Roadmap

## Confirmed limitations

- Messages use 12-second polling rather than push-based realtime.
- Email attachments are not available inside the admin mailbox.
- Support threads are grouped by sender email, not ticket or subject.
- Support assignment, priority, status, drafts, forwarding, and Reply All are not implemented.
- Customer avatar images are available only when Tappy owns a matching profile image.
- In-memory rate limiting is instance-local when the Supabase RPC is unavailable.
- The CSP still permits inline script and style execution.
- `schema.sql` is not a complete replacement for every later migration.
- Two migration files share the `022` prefix.
- `RESEND_WEBHOOK_SECRET` is missing from `.env.example`.
- Automated tests do not yet cover the complete support-thread server flow.

## Recommended priorities

### Priority 1: reliability

- Add integration tests for inbound Support creation and direct replies.
- Consolidate or document a formal migration ledger.
- Add database backup and recovery verification.
- Add delivery retry tooling for failed outbound messages.

### Priority 2: support operations

- Mark threads read and maintain accurate unread counters.
- Add resolved/open status and internal notes.
- Add attachment metadata and safe download support.
- Add browser notifications for new Support messages.
- Move from polling to Supabase Realtime, SSE, or another push channel when volume justifies it.

### Priority 3: security

- Add a shared global rate-limit provider or WAF rules.
- Remove CSP inline allowances using hashes or nonces.
- Add automated secret scanning and dependency update automation.
- Add admin session revocation and configurable expiration visibility.

### Priority 4: product operations

- Inventory tracking for physical cards.
- Card-to-order assignment and encoding verification history.
- Shipment provider and tracking integration.
- Customer self-service destination changes with approval and audit history.

## Definition of production-ready change

A change is complete only when code, migration, tests, documentation, deployment configuration, and operational verification agree. Passing a local build alone is not sufficient for workflows involving payment, customer data, email, NFC redirects, or access tokens.

