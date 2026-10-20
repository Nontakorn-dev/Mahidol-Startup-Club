-- Scheduled jobs called the old mahidol-startup-club.vercel.app address, which only kept working
-- because the proxy leaves /api alone there. They now use the production domain, kept in one
-- place: if the domain changes, replace public.cron_base_url() — the jobs pick it up on their
-- next run. (pg_net does not follow redirects, so this must be the host that serves /api itself,
-- not www.)

create or replace function public.cron_base_url() returns text
language sql immutable set search_path = public as $$
  select 'https://mahidolstartup.site'
$$;
revoke execute on function public.cron_base_url() from public, anon, authenticated;

-- Same schedules and token as 0008 / 0010 (cron.schedule replaces a job with the same name).
select cron.schedule(
  'imports-sync',
  '7 * * * *',
  $$
  select net.http_get(
    url := public.cron_base_url() || '/api/cron/imports',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hackza_cron_token'),
      'User-Agent', 'supabase-pg-cron'
    ),
    timeout_milliseconds := 60000
  );
  $$
);

select cron.schedule(
  'email-outbox',
  '* * * * *',
  $$
  select net.http_get(
    url := public.cron_base_url() || '/api/cron/outbox',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hackza_cron_token'),
      'User-Agent', 'supabase-pg-cron'
    ),
    timeout_milliseconds := 60000
  )
  where exists (
    select 1 from public.notifications
     where channel = 'email'
       and (status = 'queued' and (next_attempt_at is null or next_attempt_at <= now())
            or status = 'sending' and claimed_at < now() - interval '10 minutes')
  );
  $$
);
