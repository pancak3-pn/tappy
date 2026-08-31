# Messaging and Support

## Mailbox model

- Conversations: threads linked to an order by customer email.
- Support: inbound senders with no matching order.
- Sent: threads containing at least one outbound message.

The Messages page refreshes every 12 seconds while open, refreshes when the tab becomes visible, and refreshes when the window regains focus. Overlapping refreshes are prevented.

## Inbound flow

```text
Sender → Resend receiving address → email.received webhook
       → signature verification
       → retrieve message content from Resend
       → sanitize quoted reply text
       → match newest order by sender email
          ├─ match: order Conversation
          └─ no match: Support thread
```

Unknown senders are grouped by email address. Existing emails received before Support storage was deployed were not saved; replay those events from Resend if they are still available.

## Reply behavior

- Support replies use `email_threads.customer_email`; no order is required.
- Support default subject: `Tappy Support — <original subject>`.
- Order default subject: `Re: <original subject>` without duplicating `Re:`.
- Subject remains editable.
- Replies are saved before delivery and updated to `sent` or `failed` afterward.
- Outbound support email shows `Tappy Support`; order email shows the order number.

## Resend configuration

1. Configure a receiving domain or Resend-provided receiving address.
2. Create an `email.received` webhook targeting:

```text
https://www.tappycard.tech/api/webhooks/resend
```

3. Configure `RESEND_WEBHOOK_SECRET` in Vercel.
4. Configure `RESEND_API_KEY` and a verified `EMAIL_FROM`.
5. Send test messages from both an order email and an unknown email.
6. Confirm they appear in Conversations and Support respectively.

## Troubleshooting

### Resend receives email but Tappy does not show it

- Confirm migration `019_customer_messages.sql` ran.
- Confirm migration `022_support_email_threads.sql` ran.
- Confirm webhook status is HTTP 200, not 401, 404, or 500.
- Confirm the webhook URL includes `/api/webhooks/resend`.
- Confirm the signing secret matches the active Resend webhook.
- Open Admin → System Health and inspect webhook incidents.

### Reply cannot be sent

- Confirm `RESEND_API_KEY` and verified `EMAIL_FROM`.
- Confirm the thread has a valid customer email.
- Inspect `email_messages.delivery_status`.
- Use the response `x-request-id` to correlate Sentry or incidents.

## Current limitations

- Refresh is polling, not push-based realtime.
- Attachments are not stored or displayed.
- Support contacts do not automatically provide external avatar photos.
- One Support thread is maintained per sender email.
- Reply All, forwarding, drafts, assignment, and ticket states are not implemented.

