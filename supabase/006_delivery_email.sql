alter table public.orders
  add column if not exists delivery_email_status text not null default 'not_configured'
    check (delivery_email_status in ('not_configured', 'sent', 'failed')),
  add column if not exists delivery_email_id text,
  add column if not exists delivery_email_sent_at timestamptz;
