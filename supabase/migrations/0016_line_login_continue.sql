-- After linking in a browser without the website session (LINE's in-app browser), a one-time
-- "continue" token signs the person in there — no second login.
alter table public.line_login_states add column if not exists continue_token text unique;
alter table public.line_login_states add column if not exists continue_used_at timestamptz;
