# Testing, Deployment, and Monitoring

## Local validation

```powershell
node --check server/index.js
npm test
npm run build
```

## Test layers

### Unit tests

`npm test` covers managed profile normalization, order lifecycle enforcement, and sales metrics.

### End-to-end tests

`npm run test:e2e` covers public navigation, feedback form availability, unknown NFC behavior, and admin authorization. Playwright uses `E2E_BASE_URL` or production by default.

### Production smoke tests

`npm run test:smoke` checks API health, public feedback, and an unknown NFC link. Override production with `SMOKE_BASE_URL` when needed.

## Continuous integration

GitHub Actions validates pushes and pull requests using Node.js 22:

1. `npm ci`
2. server syntax check
3. unit tests
4. high-severity production dependency audit
5. production build

Manually dispatched workflows on `main` can run production smoke and Playwright tests.

## Deployment

1. Run required Supabase migrations first when the new code depends on them.
2. Add or update Vercel environment variables.
3. Push reviewed changes to `main`.
4. Confirm GitHub Actions succeeds.
5. Confirm Vercel production deployment succeeds.
6. Run `npm run test:smoke`.
7. Test the changed customer workflow manually.
8. Monitor System Health, Vercel, Resend, Supabase, and Sentry.

## Monitoring

- `/api/health`: basic server and database availability.
- Admin System Health: database, email, webhook, recent activity, and incidents.
- Sentry: unexpected frontend and backend exceptions.
- Vercel logs: serverless request execution.
- Resend logs: outbound delivery and inbound webhook attempts.
- Supabase logs: database, RPC, and storage failures.

## Post-deployment observation

For changes affecting orders, payment, email, NFC redirects, tokens, or database migrations, actively observe at least one real or controlled test transaction before considering the deployment complete.

