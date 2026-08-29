alter table public.orders
  add column if not exists province text,
  add column if not exists delivery_region text;

alter table public.orders
  drop constraint if exists orders_delivery_region_check;

alter table public.orders
  add constraint orders_delivery_region_check
  check (delivery_region is null or delivery_region in ('Luzon', 'Visayas', 'Mindanao'));

comment on column public.orders.province is 'Customer-selected Philippine province or Metro Manila.';
comment on column public.orders.delivery_region is 'Server-derived island group used to calculate the delivery fee.';
