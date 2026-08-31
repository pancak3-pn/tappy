# NFC Links and Managed Pages

## Permanent NFC link model

Write only the permanent Tappy HTTPS URL to the physical NFC tag:

```text
https://www.tappycard.tech/t/A72K9P
```

Do not write the final Instagram, Facebook, website, or profile URL directly when the customer expects future changes.

## Supported NFC destination types

- Website
- Instagram
- Facebook
- TikTok
- YouTube
- Google Maps
- WhatsApp

Destinations must be HTTPS. Social destination types are restricted to their recognized hostnames. The browser or operating system may offer to open the installed native application; Tappy cannot force another application to open against platform policy.

## Card preparation procedure

1. Create the destination in Admin → NFC Links.
2. Copy the generated `/t/:code` URL.
3. Write it as an HTTPS URL record using an NFC writing application.
4. Read the tag back and verify the exact URL.
5. Test on Android and iPhone.
6. Confirm the destination and tap count.
7. Lock the physical tag only when the permanent Tappy link is confirmed and the customer understands it cannot be rewritten.

## Managed profiles

Public profiles use `/p/:publicId`. Supported templates are `classic`, `split`, and `compact`. Profiles support contact details, location, photo, up to eight cleaned HTTPS links, accent presets or a validated custom color, and supported background textures.

## Customer editor access

- Admin links a managed page to a paid order.
- Server creates a random edit token and stores only its hash.
- Customer receives an expiring `/edit/:token` link.
- Revocation disables further access.
- Revisions preserve edit history.

Treat edit links as credentials. Never place them in analytics, screenshots, tickets, or public documentation.

