create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  email text not null check (char_length(email) <= 160),
  phone text not null check (char_length(phone) <= 32),
  address text not null check (char_length(address) <= 220),
  city text not null check (char_length(city) <= 100),
  postal_code text not null check (char_length(postal_code) <= 16),
  quantity integer not null check (quantity between 1 and 10),
  unit_price integer not null check (unit_price >= 0),
  shipping_fee integer not null check (shipping_fee >= 0),
  total integer not null check (total >= 0),
  payment_method text not null check (payment_method in ('gcash')),
  payment_status text not null check (payment_status in ('awaiting_payment', 'proof_submitted', 'paid', 'rejected')),
  order_status text not null check (order_status in ('pending_payment_verification', 'pending_fulfillment', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_reference text,
  payment_sender_name text,
  payment_sender_phone text,
  payment_proof_path text,
  payment_proof_submitted_at timestamptz,
  payment_decision_email_status text not null default 'not_configured'
    check (payment_decision_email_status in ('not_configured', 'sent', 'failed')),
  payment_decision_email_id text,
  payment_decision_email_type text
    check (payment_decision_email_type is null or payment_decision_email_type in ('paid', 'rejected')),
  payment_decision_email_sent_at timestamptz,
  delivery_email_status text not null default 'not_configured'
    check (delivery_email_status in ('not_configured', 'sent', 'failed')),
  delivery_email_id text,
  delivery_email_sent_at timestamptz,
  admin_read_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;
grant all on table public.orders to service_role;

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (order_status, payment_status);
create index if not exists orders_admin_unread_idx
  on public.orders (created_at desc)
  where admin_read_at is null;
create unique index if not exists orders_payment_reference_unique_idx
  on public.orders (lower(payment_reference))
  where payment_reference is not null and payment_reference <> '';

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
