-- Run this once in the Supabase SQL Editor after migrations 017 and 018.
-- Replace the placeholder with the same CRON_SECRET configured in Vercel.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select vault.create_secret(
  'REPLACE_WITH_A_LONG_RANDOM_CRON_SECRET',
  'tappy_payment_reminder_cron_secret'
);

select cron.schedule(
  'tappy-payment-reminders',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://www.tappycard.tech/api/cron/payment-reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'tappy_payment_reminder_cron_secret' limit 1)
    )
  );
  $$
);
