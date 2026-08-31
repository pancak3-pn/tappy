# Local Development

## Prerequisites

- Node.js 22
- npm
- Supabase project
- Resend account for email testing
- Optional Sentry project

## Install

```powershell
cd C:\Users\ranier\OneDrive\Desktop\businessproposal\tappy
npm ci
Copy-Item .env.example .env
```

Fill `.env` with development credentials. Do not commit `.env`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes | Server-only Supabase secret key |
| `ADMIN_PASSWORD` | Production admin | Admin login password |
| `ADMIN_TOKEN_SECRET` | Yes | Signs admin sessions; must differ from Supabase key |
| `RESEND_API_KEY` | Email features | Outbound and received-email retrieval |
| `EMAIL_FROM` | Email features | Verified sender identity |
| `RESEND_WEBHOOK_SECRET` | Inbound email | Verifies Resend webhook signatures |
| `CRON_SECRET` | Payment reminders | Protects the reminder endpoint |
| `PAYMENT_REMINDER_AFTER_MINUTES` | No | Defaults to 45, minimum 15 |
| `PORT` | Local API | Defaults to 8787 |
| `PUBLIC_SITE_URL` | Production email links | Public application origin |
| `VITE_SENTRY_DSN` | Optional | Browser error reporting |
| `SENTRY_DSN` | Optional | Server error reporting |
| `SENTRY_ENVIRONMENT` | Optional | Sentry environment name |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Optional | Source-map upload during build |

Important: `RESEND_WEBHOOK_SECRET` is used by the server but is not currently listed in `.env.example`. Add it manually until the example file is corrected.

## Start locally

Use two terminals:

```powershell
npm run dev:server
```

```powershell
npm run dev
```

Vite serves the frontend and proxies API traffic according to `vite.config.js`.

## Local verification

```powershell
node --check server/index.js
npm test
npm run build
```

Playwright defaults to production. Set `E2E_BASE_URL` before running against another environment.

```powershell
$env:E2E_BASE_URL='http://localhost:5173'
npm run test:e2e
```

