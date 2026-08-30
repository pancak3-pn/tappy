create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  email text not null check (char_length(email) <= 160),
  display_name text not null default 'Tappy customer' check (char_length(display_name) <= 60),
  rating integer not null check (rating between 1 and 5),
  product_rating integer check (product_rating between 1 and 5),
  service_rating integer check (service_rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 160),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
alter table public.feedback_tokens enable row level security;
revoke all on table public.feedback from anon, authenticated;
revoke all on table public.feedback_tokens from anon, authenticated;
grant all on table public.feedback to service_role;
grant all on table public.feedback_tokens to service_role;

create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
create unique index if not exists feedback_one_per_order_idx on public.feedback (order_id) where order_id is not null;
create index if not exists feedback_tokens_hash_idx on public.feedback_tokens (token_hash, expires_at) where used_at is null;
