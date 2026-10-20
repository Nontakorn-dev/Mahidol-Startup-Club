-- Run log: how many listings were recognised as the same event on another site.
alter table public.import_runs add column if not exists duplicates int not null default 0;
