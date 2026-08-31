# API Reference

All JSON API responses use `Cache-Control: no-store`. Protected admin endpoints require the admin session token issued by login.

## Public and customer endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Checks API and Supabase availability |
| `POST` | `/api/orders` | Creates an order; rate limited |
| `POST` | `/api/orders/:orderNumber/payment-proof` | Uploads payment proof using the signed proof token |
| `POST` | `/api/analytics` | Accepts approved first-party analytics events |
| `GET` | `/api/pages/:publicId` | Returns an active managed profile |
| `GET` | `/api/pages/edit/:token` | Loads token-authorized customer editor data |
| `PATCH` | `/api/pages/edit/:token` | Updates a customer-managed profile |
| `POST` | `/api/pages/edit/:token/photo` | Uploads a profile image |
| `DELETE` | `/api/pages/edit/:token/photo` | Removes a profile image |
| `GET` | `/t/:code` | Records a tap and redirects to the active NFC destination |
| `POST` | `/api/feedback/request` | Requests a feedback link for an eligible order |
| `GET` | `/api/feedback/verify?t=...` | Verifies a feedback token |
| `POST` | `/api/feedback/submit` | Submits verified feedback |
| `GET` | `/api/feedback/public` | Returns published reviews and averages |

## Integration endpoints

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/webhooks/resend` | Resend signature | Stores inbound email |
| `GET` | `/api/cron/payment-reminders` | Bearer cron secret | Sends due payment reminders |

## Admin endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/admin/login` | Creates an admin session |
| `GET` | `/api/admin/system-health` | Service checks, activity, and incidents |
| `GET` | `/api/admin/orders` | Paginated and filtered orders |
| `GET` | `/api/admin/order-counts` | Order queue counters |
| `PATCH` | `/api/admin/orders/:id` | Validated payment and order transitions |
| `GET` | `/api/admin/orders/:id/payment-proof` | Short-lived receipt access |
| `POST` | `/api/admin/orders/:id/feedback-link` | Sends verified feedback access |
| `GET` | `/api/admin/sales-metrics` | Revenue and region reporting |
| `GET` | `/api/admin/analytics` | First-party analytics reporting |
| `GET`, `POST` | `/api/admin/pages` | Lists or creates managed pages |
| `PATCH` | `/api/admin/pages/:id` | Updates a managed page |
| `POST`, `DELETE` | `/api/admin/pages/:id/photo` | Manages admin-uploaded photo |
| `POST`, `DELETE` | `/api/admin/pages/:id/customer-access` | Grants or revokes customer editor access |
| `GET`, `POST` | `/api/admin/messages` | Loads conversations or sends a reply |
| `GET` | `/api/admin/feedback` | Lists submitted feedback |
| `PATCH` | `/api/admin/feedback/:id` | Publishes or hides feedback |
| `GET`, `POST` | `/api/admin/nfc-tags` | Lists or creates NFC destinations |
| `PATCH`, `DELETE` | `/api/admin/nfc-tags/:id` | Updates or deletes an NFC destination |

## Error conventions

- `400`: invalid request or payload.
- `401`: missing or invalid authorization.
- `404`: resource does not exist.
- `409`: lifecycle or eligibility conflict.
- `413`: payload too large.
- `429`: rate limit reached.
- `500`: unexpected server error.
- `502`: downstream delivery failure.
- `503`: required service or migration unavailable.

Error responses use `{ "error": "Actionable message" }`. Server responses also include an `x-request-id` header for incident correlation.

