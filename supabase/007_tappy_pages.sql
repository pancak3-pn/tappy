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
