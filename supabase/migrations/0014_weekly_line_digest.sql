-- "งานที่ตรงกับคุณ" via LINE is batched into one weekly digest (Monday 08:00) to stay within the
-- OA's monthly push quota (free plan: 300). Rows wait here with status 'weekly'.
alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status in ('pending', 'digest', 'weekly', 'queued', 'sending', 'sent', 'skipped', 'failed'));
create index if not exists notifications_weekly_idx on public.notifications (status, user_id) where status = 'weekly';
