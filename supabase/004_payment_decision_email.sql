alter table public.orders
  add column if not exists payment_decision_email_status text not null default 'not_configured'
    check (payment_decision_email_status in ('not_configured', 'sent', 'failed')),
  add column if not exists payment_decision_email_id text,
  add column if not exists payment_decision_email_type text
    check (payment_decision_email_type is null or payment_decision_email_type in ('paid', 'rejected')),
  add column if not exists payment_decision_email_sent_at timestamptz;
