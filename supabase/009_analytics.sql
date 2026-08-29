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
