-- Imported opportunities (e.g. Hackza) wait here as "pending" until an admin approves them.
create table public.event_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  source_url text,
  title text not null,
  organizer text,
  poster_url text,
  source_type text,
  category text not null,
  deadline date,
  mapped jsonb not null,
  raw jsonb not null,
  relevance int not null default 0,
  matched text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  event_id uuid references public.events (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source, source_id)
);
create index event_imports_status_idx on public.event_imports (status, first_seen_at desc);

create table public.import_runs (
  id bigint generated always as identity primary key,
  source text not null,
  trigger text not null default 'cron',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched int not null default 0,
  relevant int not null default 0,
  inserted int not null default 0,
  updated int not null default 0,
  skipped int not null default 0,
  error text
);
create index import_runs_source_idx on public.import_runs (source, started_at desc);

-- Attribution for imported events ("ข้อมูลจาก Hackza")
alter table public.events add column if not exists source text;
alter table public.events add column if not exists source_url text;

alter table public.event_imports enable row level security;
alter table public.import_runs enable row level security;
