alter table public.conversations add column if not exists last_sender_id uuid references public.profiles (id) on delete set null;
