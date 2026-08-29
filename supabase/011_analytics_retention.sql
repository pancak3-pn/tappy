-- Analytics retention: keep analytics_events bounded.
-- Deletes events older than 180 days on a monthly schedule.
-- Requires the pg_cron extension (enable it in the Supabase dashboard under
-- Database > Extensions, or run: create extension if not exists pg_cron;)

create extension if not exists pg_cron;

-- Re-create the job on each run so schedule changes take effect.
select cron.unschedule('analytics-retention-cleanup')
where exists (select 1 from cron.job where jobname = 'analytics-retention-cleanup');

select cron.schedule(
  'analytics-retention-cleanup',
  '0 4 2 * *', -- 04:00 UTC on the 2nd of every month
  $$delete from public.analytics_events where created_at < now() - interval '180 days'$$
);