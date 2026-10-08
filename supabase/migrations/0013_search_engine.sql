-- How each search was answered: guard (rejected input) · cache · rules (no model call) · llm · fallback.
-- Used for the daily model-call budget (AI_DAILY_LIMIT) and to see how often the model is needed.
alter table public.search_logs add column if not exists engine text;
alter table public.search_logs add column if not exists status text;
create index if not exists search_logs_engine_day_idx on public.search_logs (engine, created_at desc);
