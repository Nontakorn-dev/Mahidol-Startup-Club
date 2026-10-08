-- 1) New users from Google: take name + picture from the OAuth metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta ->> 'full_name', meta ->> 'name', '');
  first text := coalesce(nullif(meta ->> 'first_name', ''), nullif(meta ->> 'given_name', ''), split_part(full_name, ' ', 1), '');
  last text := coalesce(nullif(meta ->> 'last_name', ''), nullif(meta ->> 'family_name', ''),
                        nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''), '');
begin
  insert into public.profiles (id, email, email_is_placeholder, first_name, last_name, avatar_url, is_verified)
  values (
    new.id, new.email,
    coalesce((meta ->> 'email_is_placeholder')::boolean, false),
    left(first, 40), left(last, 40),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture'),
    public.is_mahidol_email(new.email) and not coalesce((meta ->> 'email_is_placeholder')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) Email outbox: notifications are queued, then sent in throttled batches by a worker.
alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status in ('pending', 'queued', 'sending', 'digest', 'sent', 'skipped', 'failed'));
alter table public.notifications add column if not exists payload jsonb;
alter table public.notifications add column if not exists attempts int not null default 0;
alter table public.notifications add column if not exists next_attempt_at timestamptz;
alter table public.notifications add column if not exists claimed_at timestamptz;
create index if not exists notifications_outbox_idx on public.notifications (status, next_attempt_at) where status in ('queued', 'sending');

-- Atomically claim a batch (safe when the cron worker and an inline kick run at the same time).
create or replace function public.claim_email_outbox(batch int) returns setof public.notifications
language sql security definer set search_path = public as $$
  update public.notifications n
     set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
   where n.id in (
     select id from public.notifications
      where channel = 'email'
        and (status = 'queued' and (next_attempt_at is null or next_attempt_at <= now())
             or status = 'sending' and claimed_at < now() - interval '10 minutes')
      order by created_at
      limit batch
      for update skip locked)
  returning n.*;
$$;
revoke execute on function public.claim_email_outbox(int) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(int) to service_role;

-- 3) One cron token for all scheduled endpoints (reuses the Vault secret created for Hackza).
create or replace function public.check_cron_token(t text) returns boolean
language sql stable security definer set search_path = public, vault as $$
  select coalesce((select decrypted_secret = t from vault.decrypted_secrets where name = 'hackza_cron_token'), false)
$$;
revoke execute on function public.check_cron_token(text) from public, anon, authenticated;
grant execute on function public.check_cron_token(text) to service_role;

-- 4) Every minute, only when something is waiting: drain the email outbox.
select cron.schedule(
  'email-outbox',
  '* * * * *',
  $$
  select net.http_get(
    url := 'https://mahidol-startup-club.vercel.app/api/cron/outbox',
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
