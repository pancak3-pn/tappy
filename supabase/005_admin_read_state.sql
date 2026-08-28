alter table public.orders
  add column if not exists admin_read_at timestamptz;

create index if not exists orders_admin_unread_idx
  on public.orders (created_at desc)
  where admin_read_at is null;
