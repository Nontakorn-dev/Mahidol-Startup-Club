-- Security hardening (OWASP review, 2026-10-21).

-- 1) LINE account link: remember which LINE account the member confirmed on /line/link, so the
--    `accountLink` webhook refuses any other account (see src/lib/line/link.ts consumeNonce).
alter table public.line_link_nonces add column if not exists line_user_id text;

-- 2) Admin audit log: who changed roles, suspended accounts, published / removed content, broadcast.
--    Written by the server (service role) only; read in /admin/users.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);
alter table public.admin_audit_log enable row level security;

-- 3) Chat attachments: documents and images only (no executables / HTML). The server checks the
--    same list; this is the bucket-level backstop.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel',
  'text/plain', 'text/csv'
]
where id = 'attachments';

-- 4) Least privilege for the browser roles. Every table already has RLS (deny by default); the
--    browser only ever reads its own Realtime pings. Remove the remaining table grants so a future
--    table or a mistaken policy can't expose data by accident.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
grant select on public.conversation_pings to authenticated;  -- Realtime (RLS: own rows only)
