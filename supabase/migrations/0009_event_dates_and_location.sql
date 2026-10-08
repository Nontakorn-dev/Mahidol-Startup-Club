-- Real closing time + event period + venue for events (date system / countdown).
-- Run in Supabase → SQL Editor if it hasn't been applied.

-- Leftover unlinked duplicate from an earlier test run (no teams/saves reference it).
delete from public.events where id = 'c38a4bc1-9e7f-4451-b862-ef3cd4fadb87';
update public.events set slug = 'sustainable-cities-hackathon-camp-especially-klongs'
 where id = 'a308151e-0313-4bc3-a4f3-59d44b94f59c';

-- Exact closing moment (e.g. 12:00 or 20:00 Thai time), event period and venue.
alter table public.events add column if not exists deadline_at timestamptz;
alter table public.events add column if not exists event_start date;
alter table public.events add column if not exists event_end date;
alter table public.events add column if not exists location text;
alter table public.events add column if not exists format text check (format in ('onsite', 'online', 'hybrid'));

-- Keep `deadline` (Bangkok calendar date) and `deadline_at` consistent whichever one is written.
create or replace function public.sync_event_deadline() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.deadline_at is not distinct from old.deadline_at and new.deadline is distinct from old.deadline then
    new.deadline_at := case when new.deadline is null then null
                            else (new.deadline::timestamp + time '23:59:59') at time zone 'Asia/Bangkok' end;
  elsif new.deadline_at is not null then
    new.deadline := (new.deadline_at at time zone 'Asia/Bangkok')::date;
  elsif new.deadline is not null then
    new.deadline_at := (new.deadline::timestamp + time '23:59:59') at time zone 'Asia/Bangkok';
  end if;
  return new;
end $$;

drop trigger if exists events_sync_deadline on public.events;
create trigger events_sync_deadline before insert or update on public.events
  for each row execute function public.sync_event_deadline();

-- Existing events without an exact time close at 23:59:59 Bangkok time on their deadline date.
update public.events
   set deadline_at = (deadline::timestamp + time '23:59:59') at time zone 'Asia/Bangkok'
 where deadline is not null and deadline_at is null;

create index if not exists events_deadline_at_idx on public.events (status, deadline_at);

-- One event per source listing (approving an import twice can't duplicate it).
create unique index if not exists events_source_url_uniq on public.events (source_url) where source_url is not null;
