alter table public.orders
  add column if not exists payment_sender_name text,
  add column if not exists payment_sender_phone text,
  add column if not exists payment_proof_path text,
  add column if not exists payment_proof_submitted_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('awaiting_payment', 'proof_submitted', 'pay_on_delivery', 'paid', 'rejected'));

create unique index if not exists orders_payment_reference_unique_idx
  on public.orders (lower(payment_reference))
  where payment_reference is not null and payment_reference <> '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
