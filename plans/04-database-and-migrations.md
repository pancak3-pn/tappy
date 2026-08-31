# Database and Migrations

## Source of truth

- `supabase/schema.sql` contains the base schema and several consolidated features.
- Incremental files in `supabase/` add later production capabilities.
- The consolidated schema does not currently include every feature added after customer page editing. Do not assume `schema.sql` alone creates Messages, Feedback, NFC, rate limiting, or incidents.

## New environment procedure

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Run later feature migrations that are not represented in the consolidated file.
4. Confirm storage buckets and RLS are present.
5. Run `/api/health` after deployment.

For the current repository, explicitly review and run these later migrations:

```text
019_customer_messages.sql
020_feedback.sql
021_nfc_tags.sql
022_rate_limits.sql
022_support_email_threads.sql
023_incidents.sql
```

There are two migrations with the `022` prefix. Run both by complete filename. Do not sort or track them using the numeric prefix alone.

## Major tables

| Table | Responsibility |
| --- | --- |
| `orders` | Customer, delivery, payment, fulfillment, timestamps, and email tracking |
| `tappy_pages` | Managed public profile content and design |
| `page_edit_tokens` | Hashed customer editor access tokens |
| `tappy_page_revisions` | Profile change history |
| `analytics_events` | First-party product events |
| `email_threads` | Order-linked and Support conversation metadata |
| `email_messages` | Inbound and outbound message history |
| `feedback` | Moderated ratings and reviews |
| `feedback_tokens` | Expiring, one-time feedback links |
| `nfc_tags` | Permanent codes and destinations |
| `nfc_tap_events` | NFC usage events |
| `rate_limits` | Shared rate-limit counters through RPC |
| `system_incidents` | Sanitized operational errors |

## Storage buckets

- `payment-proofs`: private payment receipt uploads.
- `profile-images`: public profile images with controlled server uploads.

## Migration safety

- Back up production before destructive schema changes.
- Prefer additive migrations and `if not exists` where safe.
- Never edit an already-applied production migration to change history. Add a new migration.
- Validate constraints against existing rows before making a column required.
- Test API paths that depend on the migration before declaring deployment complete.

## Verification queries

```sql
select to_regclass('public.orders');
select to_regclass('public.email_threads');
select to_regclass('public.feedback');
select to_regclass('public.nfc_tags');
select to_regclass('public.system_incidents');
```

