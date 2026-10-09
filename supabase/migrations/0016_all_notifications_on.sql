-- Notification settings page removed: every member gets every notification type
-- (LINE when linked, otherwise email). Email opt-outs made from the unsubscribe link are kept.
alter table public.profiles alter column notify_announcements set default true;
update public.profiles
set notify_invites = true, notify_matches = true, notify_reminders = true, notify_announcements = true
where not (notify_invites and notify_matches and notify_reminders and notify_announcements);
