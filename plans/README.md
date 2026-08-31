# Tappy Project Documentation

This directory is the operational and engineering documentation for Tappy. Start here, then follow the guide that matches the work being performed.

## Documentation map

| Document | Purpose |
| --- | --- |
| [01-product-overview.md](01-product-overview.md) | Product scope, users, capabilities, and supported journeys |
| [02-system-architecture.md](02-system-architecture.md) | Frontend, API, Supabase, Resend, Vercel, and data flow |
| [03-local-development.md](03-local-development.md) | Prerequisites, environment variables, local startup, and verification |
| [04-database-and-migrations.md](04-database-and-migrations.md) | Schema ownership, migration order, storage buckets, and database checks |
| [05-api-reference.md](05-api-reference.md) | Public, customer, admin, webhook, and cron endpoints |
| [06-orders-payments-and-fulfillment.md](06-orders-payments-and-fulfillment.md) | Checkout, GCash proof, lifecycle rules, delivery, and fulfillment |
| [07-messaging-and-support.md](07-messaging-and-support.md) | Order conversations, inbound support, Resend webhook, and replies |
| [08-nfc-and-managed-pages.md](08-nfc-and-managed-pages.md) | Permanent NFC links, redirects, managed profiles, and customer access |
| [09-admin-operations.md](09-admin-operations.md) | Daily admin workflows, reports, feedback, monitoring, and incident handling |
| [10-security-and-privacy.md](10-security-and-privacy.md) | Authentication, validation, rate limits, headers, secrets, and privacy controls |
| [11-testing-deployment-and-monitoring.md](11-testing-deployment-and-monitoring.md) | Automated tests, CI, Vercel deployment, smoke checks, and Sentry |
| [12-production-runbook.md](12-production-runbook.md) | Deployment checklist, rollback thinking, troubleshooting, and recurring maintenance |
| [13-known-limitations-and-roadmap.md](13-known-limitations-and-roadmap.md) | Current constraints and recommended engineering priorities |

## Documentation rules

- Update the relevant guide in the same change that modifies a production workflow.
- Never place real credentials, signing secrets, edit tokens, customer information, or payment receipts in this directory.
- Treat code and migrations as the source of truth when documentation becomes stale.
- Use exact migration filenames because two migrations currently share the `022` prefix.
- Test operational instructions against production-safe endpoints before relying on them during an incident.

## Current production identity

- Website: `https://www.tappycard.tech`
- Platform: Vercel
- Database and storage: Supabase
- Transactional and inbound email: Resend
- Error monitoring: Sentry when configured
- Primary admin route: `/r`

