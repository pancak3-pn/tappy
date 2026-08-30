create table if not exists public.system_incidents (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'error' check (severity in ('info','warning','error','critical')),
  source text not null check (char_length(source) <= 80),
  message text not null check (char_length(message) <= 500),
  request_id text check (char_length(request_id) <= 120),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.system_incidents enable row level security;
revoke all on table public.system_incidents from anon, authenticated;
grant all on table public.system_incidents to service_role;
create index if not exists system_incidents_created_idx on public.system_incidents (created_at desc);
