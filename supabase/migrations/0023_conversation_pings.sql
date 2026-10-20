-- Live chat updates without exposing chat rows: the server upserts a ping for the other
-- participant on every new message; the open chat listens (Realtime) and re-renders from the
-- server. A ping holds only the conversation id and the reader's own id — never who sent what.
-- (0024 then removes the browser's read access to the chat tables themselves.)

create table if not exists public.conversation_pings (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pinged_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_pings enable row level security;
create policy "own pings readable" on public.conversation_pings
  for select to authenticated using (user_id = (select auth.uid()));
alter publication supabase_realtime add table public.conversation_pings;
