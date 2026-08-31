# Orders, Payments, and Fulfillment

## Pricing

- Card unit price: PHP 199.
- Quantity: 1 to 10 cards.
- Payment method: GCash.
- Delivery fees: Luzon PHP 80, Visayas PHP 100, Mindanao PHP 120.
- The server calculates price and region. Browser totals are informational only.

## Payment states

```text
awaiting_payment → proof_submitted → paid
                                 └→ rejected → proof_submitted
```

Payment approval requires an uploaded proof. A paid status is terminal.

## Order states

```text
pending_payment_verification
  → pending_fulfillment
  → processing
  → shipped
  → delivered
```

Cancellation is allowed before shipping according to the transition rules. Moving to `pending_fulfillment` requires `payment_status = paid`. Backward transitions are rejected.

## Lifecycle timestamps

- `payment_approved_at`
- `processing_started_at`
- `shipped_at`
- `delivered_at`
- `cancelled_at`

The timestamp is set only when first entering its matching state.

## Daily fulfillment procedure

1. Open Admin → Orders → Payment review.
2. Open the private receipt and compare amount, sender, reference, and order.
3. Approve valid payments or reject invalid proofs with an internal note.
4. Move paid orders to pending fulfillment.
5. Prepare and customize the physical card.
6. Encode and test the permanent Tappy HTTPS link.
7. Move the order to processing, then shipped with tracking communication.
8. Mark delivered only after confirmation or reliable carrier status.
9. Send the feedback link after completion when appropriate.

## Payment reminders

The cron endpoint selects orders that are still awaiting payment, have not received a reminder, and are older than the configured delay. It attempts one tracked reminder per order.

Use the SQL example in `supabase/payment-reminder-cron.example.sql` and store the secret in Supabase Vault or the scheduler’s protected secret store.

## Failure handling

- Failed confirmation email does not delete the order.
- Failed reminder delivery is recorded and may be retried by operations.
- Failed status email should appear in health metrics and message delivery state.
- Never approve payment based only on an email attachment without verifying the order and transaction.

