# Admin Operations

## Admin areas

- Overview: sales, workload, unread orders, and summaries.
- Orders: payment verification and fulfillment lifecycle.
- Messages: order conversations, Support inquiries, and sent email.
- Tappy Pages: profile creation, editing, photos, and customer access.
- NFC Links: permanent codes, destinations, tap counts, and deletion.
- Reports: revenue, sales, analytics, and delivery-region performance.
- System Health: dependency checks, email/webhook activity, and incidents.
- Feedback: moderation and publishing.

## Daily opening checklist

1. Open System Health and confirm services are operational.
2. Review Payment review and To fulfill queues.
3. Review unread Conversations and Support.
4. Check failed emails and webhook incidents.
5. Review new payment proofs before preparing cards.

## Messaging expectations

- Messages refresh automatically every 12 seconds while the page is visible.
- Refreshing the browser is not required for normal inbound email.
- Keep the Messages page open during active support periods.
- Verify the recipient and subject before sending.
- Do not include payment credentials, admin secrets, or customer edit tokens in replies.

## Feedback moderation

- Feedback requests are limited to eligible completed customers.
- Links expire and are single-use.
- Submitted feedback remains private until published.
- Publish authentic feedback without exposing private order information.
- Hide content containing personal data, abuse, spam, or unrelated material.

## Incident handling

1. Record the time, affected workflow, user-visible symptom, and request ID.
2. Check System Health.
3. Check Vercel deployment status and function logs.
4. Check Supabase status, schema, and storage.
5. Check Resend logs for email failures.
6. Check Sentry for the matching request ID or operation tag.
7. Restore service before performing nonessential cleanup.
8. Document cause, correction, and prevention.

## Closing checklist

- No valid payment proofs remain unreviewed.
- Shipment updates and tracking messages are sent.
- Support inquiries have a response or documented next action.
- Failed email deliveries are understood.
- Production health is operational.

