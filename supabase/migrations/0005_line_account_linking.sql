-- LINE is linked to an email account (never used to sign in).
-- One-time codes shown on the website ("เชื่อมบัญชี ABC123" sent in the OA chat)
create table public.line_link_codes (
  code text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index line_link_codes_user_idx on public.line_link_codes (user_id);

-- Nonces for LINE Messaging API account linking (linkToken flow started from the OA)
create table public.line_link_nonces (
  nonce text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.line_link_codes enable row level security;
alter table public.line_link_nonces enable row level security;
