alter table public.orders
  add column if not exists payment_reminder_email_status text not null default 'not_configured'
    check (payment_reminder_email_status in ('not_configured', 'sent', 'failed')),
  add column if not exists payment_reminder_email_id text,
  add column if not exists payment_reminder_email_sent_at timestamptz,
  add column if not exists payment_reminder_last_attempt_at timestamptz;

create index if not exists orders_payment_reminder_due_idx
  on public.orders (created_at)
  where payment_status = 'awaiting_payment'
    and order_status = 'pending_payment_verification'
    and payment_reminder_email_sent_at is null;
