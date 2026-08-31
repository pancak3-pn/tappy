# Production Runbook

## Standard release checklist

### Before deployment

- Review `git status` and staged changes.
- Confirm no secrets or customer data are included.
- Run server syntax, tests, dependency audit, and production build.
- Review migrations and take a database backup for risky changes.
- Confirm new environment variables exist in Production and Preview as required.

### Deployment

- Apply backward-compatible database migrations.
- Deploy application code.
- If the admin hostname changed, verify Vercel domain and DNS status before testing login.
- Confirm `/api/health` returns HTTP 200.
- Run production smoke tests.
- Verify the primary changed flow.

### After deployment

- Check GitHub Actions and Vercel deployment status.
- Check System Health and open incidents.
- Check Resend webhook and delivery logs for email changes.
- Check Sentry for new errors.

## Troubleshooting matrix

| Symptom | First checks |
| --- | --- |
| Site returns Vercel 404 | `vercel.json` rewrites, deployment branch, route path |
| `/api/health` returns 404 | API rewrite and `api/index.js` deployment |
| `/api/health` returns 503 | Supabase variables, project status, schema |
| Admin returns 401 | Login/session token and `ADMIN_TOKEN_SECRET` consistency |
| `admin.tappycard.tech` shows the public site | Vercel domain is not attached, DNS is not verified, or the hostname does not match exactly |
| Orders fail | rate limits, orders schema, Supabase logs, request payload |
| Receipt cannot upload | signed proof token, bucket, file type/size, storage configuration |
| Email not sent | Resend key, verified sender, delivery log, message status |
| Inbound email missing | webhook URL/signature, migrations 019 and support migration, Resend replay |
| Support reply demands order | deploy latest frontend/server together and confirm support migration |
| NFC returns 404 | exact code, active tag, rewrite, destination record |
| Profile editor unavailable | token expiry/revocation, hashed token row, linked page |
| Feedback link repeats | migration 020/022 rate limits, existing token and feedback records |

## Safe rollback approach

- Prefer deploying the last known-good Git commit through Vercel.
- Do not reverse a database migration blindly.
- Keep additive columns and tables during application rollback unless they directly cause failure.
- Write a forward corrective migration for schema problems.
- Rotate compromised credentials instead of only rolling back code.

## Recovery priorities

1. Protect customer and payment data.
2. Stop unauthorized access or repeated destructive behavior.
3. Restore order intake and payment verification.
4. Restore messaging and email delivery.
5. Restore analytics and noncritical presentation features.

## Monthly maintenance

- Review dependency updates and `npm audit`.
- Review admin accounts and rotate sensitive credentials when appropriate.
- Review Sentry issues and system incidents.
- Confirm backups and storage access.
- Remove expired tokens and old analytics according to retention policy.
- Test one NFC redirect, one order, one message, and one feedback flow.
