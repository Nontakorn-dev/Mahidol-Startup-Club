-- Member directory (/people): profiles are listed unless the member turns it off.
alter table public.profiles add column if not exists profile_public boolean not null default true;
