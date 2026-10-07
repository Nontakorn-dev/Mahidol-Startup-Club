-- Vercel Hobby only allows daily crons, so the 6-hourly Hackza sync is scheduled here.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Random token generated inside the database (never leaves it except in the request header below).
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'hackza_cron_token', 'Auth for /api/cron/hackza called by pg_cron')
where not exists (select 1 from vault.secrets where name = 'hackza_cron_token');

-- The API verifies the bearer token through this function (service role only).
create or replace function public.check_hackza_cron_token(t text) returns boolean
language sql stable security definer set search_path = public, vault as $$
  select coalesce((select decrypted_secret = t from vault.decrypted_secrets where name = 'hackza_cron_token'), false)
$$;
revoke execute on function public.check_hackza_cron_token(text) from public, anon, authenticated;
grant execute on function public.check_hackza_cron_token(text) to service_role;

-- Change the URL if the production domain changes.
select cron.schedule(
  'hackza-sync',
  '7 */6 * * *',
  $$
  select net.http_get(
    url := 'https://mahidol-startup-club.vercel.app/api/cron/hackza',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hackza_cron_token'),
      'User-Agent', 'supabase-pg-cron'
    ),
    timeout_milliseconds := 60000
  );
  $$
);
