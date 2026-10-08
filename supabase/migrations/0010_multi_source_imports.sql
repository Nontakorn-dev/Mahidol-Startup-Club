-- Import from several sources (Hackza, Contester.Life, CAMPHUB, DekPort, Devpost) into one review queue.

-- 1) Cross-source duplicates are kept (for verification) but hidden from the main queue.
alter table public.event_imports drop constraint if exists event_imports_status_check;
alter table public.event_imports add constraint event_imports_status_check
  check (status in ('pending', 'approved', 'rejected', 'expired', 'duplicate'));

alter table public.event_imports
  add column if not exists deadline_at timestamptz,
  add column if not exists levels text[] not null default '{}',
  add column if not exists flags text[] not null default '{}',
  add column if not exists duplicate_of uuid references public.event_imports (id) on delete set null,
  add column if not exists duplicate_event_id uuid references public.events (id) on delete set null;

create index if not exists event_imports_source_idx on public.event_imports (source, status);
create index if not exists event_imports_duplicate_of_idx on public.event_imports (duplicate_of) where duplicate_of is not null;

update public.event_imports set deadline_at = (mapped->>'deadline_at')::timestamptz
where deadline_at is null and mapped->>'deadline_at' is not null;

-- 2) Old Hackza snapshots kept unresolved RSC references ("$2c") as the description.
--    The published events were already corrected — copy their text back into the snapshot.
update public.event_imports i
set mapped = jsonb_set(i.mapped, '{overview}', coalesce(to_jsonb(e.overview), 'null'::jsonb))
from public.events e
where e.id = i.event_id and i.mapped->>'overview' ~ '^\$[0-9a-f]{1,4}$';

update public.event_imports
set mapped = jsonb_set(mapped, '{overview}', 'null'::jsonb)
where mapped->>'overview' ~ '^\$[0-9a-f]{1,4}$';

-- 3) One hourly job syncs whichever sources are due (each source at most every ~6 hours).
select cron.unschedule('hackza-sync') where exists (select 1 from cron.job where jobname = 'hackza-sync');
select cron.schedule(
  'imports-sync',
  '7 * * * *',
  $$
  select net.http_get(
    url := 'https://mahidol-startup-club.vercel.app/api/cron/imports',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hackza_cron_token'),
      'User-Agent', 'supabase-pg-cron'
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- 4) (applied as 0011) Listings the filter dropped are remembered as "skipped" so admins can
--    rescue false negatives and unchanged pages aren't fetched again.
alter table public.event_imports drop constraint if exists event_imports_status_check;
alter table public.event_imports add constraint event_imports_status_check
  check (status in ('pending', 'approved', 'rejected', 'expired', 'duplicate', 'skipped'));
alter table public.event_imports add column if not exists skip_reason text;
alter table public.import_runs add column if not exists duplicates int not null default 0;
