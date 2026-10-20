-- "Domain expert" needs the field spelled out (e.g. การแพทย์, กฎหมาย): one for the poster, one for who they seek.
alter table public.cofounder_posts add column if not exists my_domain text;
alter table public.cofounder_posts add column if not exists seeking_domain text;
