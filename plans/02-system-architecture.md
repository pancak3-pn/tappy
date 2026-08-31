# System Architecture

## Components

```text
Browser
  ├─ React 19 + Vite frontend
  └─ /api requests
         ↓
Vercel
  ├─ Static frontend in dist/
  ├─ api/index.js serverless adapter
  └─ server/index.js request handler
         ├─ Supabase database and storage
         ├─ Resend email API and inbound webhook
         └─ Sentry error reporting
```

## Frontend

- Entry point: `src/main.jsx`
- Route selection: pathname-based routing in `src/App.jsx`
- Admin application: `src/AdminDashboard.jsx`
- Managed profile: `src/TappyPage.jsx` and `src/ManagedProfileCard.jsx`
- Customer editor: `src/CustomerPageEditor.jsx`
- Feedback: `src/FeedbackPage.jsx`
- Shared business rules: `shared/`

The frontend is a client-rendered React application. Vercel rewrites public application routes to `index.html`.

## Backend

- Core handler: `server/index.js`
- Vercel entry: `api/index.js`
- Local process: Node HTTP server through `npm run dev:server`

The server owns all privileged Supabase access. `SUPABASE_SECRET_KEY` must never be exposed to browser code or prefixed with `VITE_`.

## Data ownership

Supabase stores orders, profiles, analytics, edit tokens, profile revisions, messages, feedback, NFC destinations, tap events, rate-limit counters, and system incidents. Supabase Storage holds payment proofs and profile images.

Row Level Security is enabled on application tables. The server uses the secret key and performs application authorization before accessing protected data.

## External integrations

- Resend: outbound transactional email and inbound email receiving.
- Sentry: frontend and server error monitoring when DSNs are configured.
- Vercel: hosting, routing, serverless execution, TLS, and response headers.
- Supabase: PostgreSQL, RPC rate limiting, and object storage.

## Important trust boundaries

- Browser input is untrusted and validated again on the server.
- Admin requests require a signed admin session token.
- Customer profile edits require a hashed, expiring edit token.
- Payment-proof uploads require a signed order token.
- Resend webhooks require signature verification.
- Cron requests require `Authorization: Bearer <CRON_SECRET>`.

## Admin subdomain

The frontend recognizes `admin.tappycard.tech` as an admin-only entry point. The existing `/r` route remains supported for backward compatibility and local testing. The hostname check does not replace authentication; the admin session is still required before protected data loads.

To activate the subdomain in production:

1. In Vercel, open the Tappy project and add `admin.tappycard.tech` under Domains.
2. At the DNS provider, create the record Vercel requests (normally a CNAME to the Vercel target).
3. Wait for TLS/domain verification.
4. Open `https://admin.tappycard.tech` and confirm it shows the admin login.
5. Confirm `https://www.tappycard.tech/r` still works.

Keep the admin subdomain on the same project until a separate deployment is intentionally required. Do not loosen API authentication because a request originated from the admin hostname.
