-- Listings the filter dropped are remembered as "skipped" so admins can rescue false negatives
-- and unchanged pages aren't fetched again.
alter table public.event_imports drop constraint if exists event_imports_status_check;
alter table public.event_imports add constraint event_imports_status_check
  check (status in ('pending', 'approved', 'rejected', 'expired', 'duplicate', 'skipped'));
alter table public.event_imports add column if not exists skip_reason text;
