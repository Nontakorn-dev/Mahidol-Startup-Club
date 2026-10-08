-- "เชื่อมต่อ LINE" (LINE Login) flow state kept server-side: on phones LINE often returns to the
-- callback inside the LINE app's own browser, which has none of the website's cookies. The
-- state is one-time and expires after 10 minutes. Service role only (RLS on, no policies).
create table if not exists public.line_login_states (
  state text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  nonce text not null,
  next text not null default '/settings/notifications',
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists line_login_states_created_idx on public.line_login_states (created_at);
alter table public.line_login_states enable row level security;
