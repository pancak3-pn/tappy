alter table public.orders
  add column if not exists confirmation_email_status text not null default 'not_configured'
    check (confirmation_email_status in ('not_configured', 'sent', 'failed')),
  add column if not exists confirmation_email_id text;

create index if not exists orders_email_status_idx
  on public.orders (confirmation_email_status);
