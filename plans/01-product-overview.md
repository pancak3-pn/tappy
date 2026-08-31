# Product Overview

## What Tappy is

Tappy sells reusable NFC cards that open a permanent Tappy URL. The destination behind that URL can be changed without rewriting the physical card. Customers can use a direct social or website destination, or a managed Tappy profile.

## Primary users

- Buyer: orders and pays for a Tappy card.
- Card owner: manages or uses the profile connected to a card.
- Visitor: taps a card and opens its destination.
- Tappy administrator: verifies payment, fulfills orders, manages profiles and NFC links, answers messages, publishes feedback, and monitors health.

## Main capabilities

- Responsive public marketing site and checkout.
- Philippine delivery pricing by province and region.
- GCash payment proof submission and verification.
- Controlled order and payment lifecycle.
- Order confirmation, status, reminder, and support email delivery.
- Inbound order replies and non-order Support conversations.
- Permanent `/t/:code` NFC redirects with tap tracking.
- Managed public profiles at `/p/:publicId`.
- Token-protected customer profile editor at `/edit/:token`.
- Verified, single-use customer feedback workflow.
- Admin orders, messages, pages, NFC links, reports, feedback, and system health.
- First-party analytics and Sentry error monitoring.

## Customer journeys

### Purchase

1. Customer opens `/order`.
2. Customer enters contact and delivery details.
3. Server validates the province, quantity, payment method, and rate limit.
4. Order is created and confirmation email is attempted.
5. Customer submits a GCash receipt using the signed proof token.
6. Admin approves or rejects the proof.
7. Approved orders move through fulfillment, processing, shipped, and delivered.

### NFC tap

1. Phone reads `https://www.tappycard.tech/t/CODE` from the NFC tag.
2. Tappy validates the code and active destination.
3. A tap event is recorded.
4. Tappy redirects to the configured HTTPS destination.

### Support

1. An order customer replies to a Tappy email, or any sender emails the Resend receiving address.
2. Resend sends an `email.received` webhook to Tappy.
3. Matching order senders enter Conversations; unknown senders enter Support.
4. Admin replies from the Messages page without requiring an order for Support threads.

