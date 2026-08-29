create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  email text not null check (char_length(email) <= 160),
  phone text not null check (char_length(phone) <= 32),
  address text not null check (char_length(address) <= 220),
  city text not null check (char_length(city) <= 100),
  province text,
  delivery_region text check (delivery_region is null or delivery_region in ('Luzon', 'Visayas', 'Mindanao')),
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

create table if not exists public.tappy_pages (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null check (public_id ~ '^[A-Za-z0-9_-]{22}$'),
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'disabled')),
  display_name text not null check (char_length(display_name) between 1 and 100),
  headline text check (headline is null or char_length(headline) <= 120),
  bio text check (bio is null or char_length(bio) <= 360),
  photo_url text check (photo_url is null or char_length(photo_url) <= 500),
  email text check (email is null or char_length(email) <= 160),
  phone text check (phone is null or char_length(phone) <= 32),
  location text check (location is null or char_length(location) <= 140),
  accent text not null default 'forest' check (accent in ('forest', 'ink', 'blue')),
  background_texture text not null default 'clean' check (background_texture in ('clean', 'linen', 'silver', 'forest-grain', 'blueprint')),
  template text not null default 'classic' check (template in ('classic', 'split', 'compact')),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 1000),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tappy_pages enable row level security;
revoke all on table public.tappy_pages from anon, authenticated;
grant all on table public.tappy_pages to service_role;

create unique index if not exists tappy_pages_order_unique_idx
  on public.tappy_pages (order_id)
  where order_id is not null;
create index if not exists tappy_pages_created_at_idx on public.tappy_pages (created_at desc);
create index if not exists tappy_pages_status_idx on public.tappy_pages (status, updated_at desc);

drop trigger if exists tappy_pages_set_updated_at on public.tappy_pages;
create trigger tappy_pages_set_updated_at before update on public.tappy_pages
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid unique not null,
  event_name text not null check (event_name in ('homepage_view', 'order_click', 'checkout_start', 'order_completed', 'profile_view')),
  session_id text check (session_id is null or char_length(session_id) <= 64),
  page_id text check (page_id is null or page_id ~ '^[A-Za-z0-9_-]{22}$'),
  order_id uuid references public.orders(id) on delete set null,
  path text check (path is null or char_length(path) <= 180),
  created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from anon, authenticated;
grant all on table public.analytics_events to service_role;
create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_name_created_idx on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_page_created_idx on public.analytics_events (page_id, created_at desc) where page_id is not null;

create table if not exists public.page_edit_tokens (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.tappy_pages(id) on delete cascade,
  token_hash text unique not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tappy_page_revisions (
  id bigint generated always as identity primary key,
  page_id uuid not null references public.tappy_pages(id) on delete cascade,
  changed_by text not null check (changed_by in ('admin', 'customer')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.page_edit_tokens enable row level security;
alter table public.tappy_page_revisions enable row level security;
revoke all on table public.page_edit_tokens from anon, authenticated;
revoke all on table public.tappy_page_revisions from anon, authenticated;
grant all on table public.page_edit_tokens to service_role;
grant all on table public.tappy_page_revisions to service_role;
create index if not exists page_edit_tokens_page_idx on public.page_edit_tokens (page_id, created_at desc);
create index if not exists page_edit_tokens_active_idx on public.page_edit_tokens (token_hash, expires_at) where revoked_at is null;
create unique index if not exists page_edit_tokens_one_active_idx on public.page_edit_tokens (page_id) where revoked_at is null;
create index if not exists tappy_page_revisions_page_idx on public.tappy_page_revisions (page_id, created_at desc);
