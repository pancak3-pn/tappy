-- Allow inbound support conversations that are not linked to an order.
alter table public.email_threads alter column order_id drop not null;
alter table public.email_threads alter column customer_name drop not null;
create unique index if not exists email_threads_support_sender_idx
  on public.email_threads (customer_email)
  where order_id is null;
