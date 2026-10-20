-- Per-person limit on language-model calls, shared by every serverless instance (the in-memory
-- counter in src/lib/ai/intent.ts only saw one instance). Fixed window; one row per key.
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table public.rate_limits enable row level security;

-- Counts this hit and says whether it is still within the limit (atomic under concurrency).
create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language sql security definer set search_path = public as $$
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits <= p_max;
$$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
