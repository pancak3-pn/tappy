create table if not exists public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9]{6,16}$'),
  destination_type text not null default 'website' check (destination_type in ('website','instagram','facebook','tiktok','youtube','maps','whatsapp')),
  destination_url text not null check (destination_url ~ '^https://'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.nfc_tap_events (
  id uuid primary key default gen_random_uuid(), tag_id uuid not null references public.nfc_tags(id) on delete cascade,
  destination_type text not null, user_agent text, referrer text, created_at timestamptz not null default now()
);
alter table public.nfc_tags enable row level security;
alter table public.nfc_tap_events enable row level security;
revoke all on table public.nfc_tags, public.nfc_tap_events from anon, authenticated;
grant all on table public.nfc_tags, public.nfc_tap_events to service_role;
create index if not exists nfc_tap_events_tag_created_idx on public.nfc_tap_events(tag_id, created_at desc);
