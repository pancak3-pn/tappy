create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;
grant all on table public.rate_limits to service_role;

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare current_count integer;
declare current_reset timestamptz;
begin
  select count, reset_at into current_count, current_reset from public.rate_limits where key = p_key for update;
  if not found or current_reset <= now() then
    insert into public.rate_limits(key, count, reset_at)
      values (p_key, 1, now() + make_interval(secs => p_window_seconds))
      on conflict (key) do update set count = 1, reset_at = excluded.reset_at;
    return true;
  end if;
  if current_count >= p_limit then return false; end if;
  update public.rate_limits set count = count + 1 where key = p_key;
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
