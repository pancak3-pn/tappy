# Security and Privacy

## Secret management

- Store production secrets only in Vercel and provider secret stores.
- Never expose `SUPABASE_SECRET_KEY`, `ADMIN_TOKEN_SECRET`, `CRON_SECRET`, Resend secrets, or Sentry auth tokens through `VITE_` variables.
- Use different high-entropy values for admin session signing and Supabase access.
- Rotate a secret immediately if it appears in Git history, logs, screenshots, or chat.

## Authentication and authorization

- Admin login verifies the configured password and issues a signed session.
- All `/api/admin/*` endpoints except login require the admin session.
- Customer profile access uses hashed, expiring, revocable tokens.
- Payment proof access uses a signed order token.
- Cron and webhook endpoints have separate authentication mechanisms.

## Input and output controls

- Request bodies have explicit byte limits.
- Strings are trimmed and length-limited.
- NFC and profile URLs require HTTPS and approved types.
- Profile colors and templates are allow-listed.
- Order price, delivery fee, statuses, and transitions are server controlled.
- HTML email content is escaped before insertion.
- Incident messages redact email addresses.

## Rate limiting

The server first calls the Supabase `consume_rate_limit` RPC. If unavailable, it falls back to an in-memory instance-local limiter. The fallback reduces bursts but is not globally strict across Vercel instances.

Production hardening option: use Vercel WAF, Upstash Redis, or another shared edge/global limiter for abuse-sensitive endpoints.

## Browser security headers

`vercel.json` configures:

- Content Security Policy
- HSTS
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- strict referrer policy
- restrictive permissions policy
- `noindex` headers for admin, order, feedback, API, public profile, and edit-token routes

The CSP currently allows inline scripts and styles. Removing `'unsafe-inline'` through nonces, hashes, or extracted styles is a future hardening task.

## Privacy controls

- Sentry is configured with `sendDefaultPii:false`.
- Authorization, cookies, request bodies, and edit-token URLs are removed or redacted from Sentry events.
- Payment proof storage is private.
- Public profile pages receive a no-referrer policy.
- Edit and API responses use no-store behavior where configured.

## Security verification

```powershell
npm audit --omit=dev --audit-level=high
curl.exe -I https://www.tappycard.tech
curl.exe -i https://www.tappycard.tech/api/admin/orders
```

Expected unauthenticated admin result: HTTP 401 with `Admin session required.`

Never place Markdown link syntax around URLs passed to `curl.exe`.

