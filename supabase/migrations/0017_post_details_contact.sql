-- Fuller posts: a long description and a contact line, shown on the post's own page (not on cards).
alter table public.team_posts add column if not exists contact text;
alter table public.seeker_posts add column if not exists contact text;
alter table public.cofounder_posts add column if not exists contact text;
alter table public.cofounder_posts add column if not exists details text;
