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
