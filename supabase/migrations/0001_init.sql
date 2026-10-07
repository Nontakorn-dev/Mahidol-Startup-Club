-- Mahidol Startup Club — initial schema
-- Writes go through the Next.js server (service role) after an explicit auth check.
-- RLS is enabled everywhere; the only client-side reads are published events,
-- the caller's own profile, and conversations/messages they participate in (Realtime).

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  email_is_placeholder boolean not null default false,
  first_name text not null default '',
  last_name text not null default '',
  avatar_url text,
  faculty text,
  year text,
  campus text,
  headline text,
  bio text,
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  links jsonb not null default '[]',
  experiences jsonb not null default '[]',
  availability text,
  work_mode text,
  start_when text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_suspended boolean not null default false,
  is_verified boolean not null default false,
  line_user_id text unique,
  line_display_name text,
  line_picture_url text,
  line_is_friend boolean not null default false,
  line_linked_at timestamptz,
  notify_invites boolean not null default true,
  notify_matches boolean not null default true,
  notify_reminders boolean not null default true,
  notify_announcements boolean not null default false,
  notify_frequency text not null default 'instant' check (notify_frequency in ('instant', 'daily')),
  email_notifications boolean not null default true,
  onboarded boolean not null default false,
  admin_last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_mahidol_email(e text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(lower(e) ~ '@(student\.)?mahidol\.(ac\.th|edu)$', false)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, email_is_placeholder, first_name, last_name, avatar_url, is_verified)
  values (
    new.id,
    new.email,
    coalesce((meta ->> 'email_is_placeholder')::boolean, false),
    coalesce(meta ->> 'first_name', ''),
    coalesce(meta ->> 'last_name', ''),
    meta ->> 'avatar_url',
    public.is_mahidol_email(new.email) and not coalesce((meta ->> 'email_is_placeholder')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep profiles.email in sync when a user changes / confirms an email
create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = new.email,
           email_is_placeholder = false,
           is_verified = is_verified or public.is_mahidol_email(new.email),
           updated_at = now()
     where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------- events (opportunities)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default '',
  category text not null default 'competition'
    check (category in ('grant', 'team_recruit', 'competition', 'incubation', 'workshop')),
  poster_url text,
  organizer text,
  benefit text,
  eligibility text,
  overview text,
  apply_url text,
  deadline date,
  open_note text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_club boolean not null default false,
  allow_teams boolean not null default true,
  featured boolean not null default false,
  notify_on_publish boolean not null default true,
  notified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_status_deadline_idx on public.events (status, deadline);
create index events_title_trgm on public.events using gin (title gin_trgm_ops);

create table public.event_metrics (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('view', 'apply')),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index event_metrics_event_idx on public.event_metrics (event_id, kind, created_at);

create table public.saved_events (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- ---------------------------------------------------------------- community posts
create table public.team_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  event_id uuid references public.events (id) on delete set null,
  event_note text,
  pitch text not null default '',
  details text,
  members_count int not null default 1 check (members_count >= 1),
  target_size int not null default 4 check (target_size >= 2),
  has_skills text[] not null default '{}',
  roles_needed text[] not null default '{}',
  is_anonymous boolean not null default false,
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index team_posts_status_idx on public.team_posts (status, created_at desc);
create index team_posts_event_idx on public.team_posts (event_id);

create table public.team_members (
  team_id uuid not null references public.team_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.seeker_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  looking_text text not null,
  event_id uuid references public.events (id) on delete set null,
  skills text[] not null default '{}',
  details text,
  is_anonymous boolean not null default false,
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seeker_posts_status_idx on public.seeker_posts (status, created_at desc);

create table public.cofounder_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  my_skills text[] not null default '{}',
  about text,
  seeking text[] not null default '{}',
  portfolio_url text,
  idea_title text,
  problem text,
  stage text not null default 'idea' check (stage in ('idea', 'prototype', 'mvp', 'revenue')),
  commitment text,
  is_anonymous boolean not null default false,
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cofounder_posts_status_idx on public.cofounder_posts (status, created_at desc);

-- ---------------------------------------------------------------- messaging
-- request_kind: message = plain DM, intro = ขอทำความรู้จัก (someone is anonymous),
-- invite = team owner invites a person, join = person asks to join a team.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_kind text not null default 'message' check (request_kind in ('message', 'intro', 'invite', 'join')),
  request_status text not null default 'none' check (request_status in ('none', 'pending', 'accepted', 'declined')),
  team_id uuid references public.team_posts (id) on delete set null,
  target_type text check (target_type in ('profile', 'seeker', 'team', 'cofounder')),
  target_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  created_at timestamptz not null default now()
);
create index conversations_last_idx on public.conversations (last_message_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('requester', 'recipient')),
  is_anonymous boolean not null default false,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'system')),
  body text not null default '',
  attachment_path text,
  attachment_name text,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------- notifications & broadcasts
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null check (topic in ('invites', 'matches', 'reminders', 'announcements', 'system')),
  title text not null,
  body text,
  url text,
  image_url text,
  status text not null default 'pending' check (status in ('pending', 'digest', 'sent', 'skipped', 'failed')),
  channel text check (channel in ('line', 'email')),
  error text,
  broadcast_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_status_idx on public.notifications (status);

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text,
  image_url text,
  audience text not null default 'subscribers' check (audience in ('subscribers', 'all', 'saved_event')),
  audience_event_id uuid references public.events (id) on delete set null,
  send_line boolean not null default true,
  send_email boolean not null default true,
  stats jsonb not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- ---------------------------------------------------------------- AI search
create table public.search_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  source text not null default 'web' check (source in ('web', 'line')),
  query text not null,
  parsed jsonb,
  confidence real,
  used_fallback boolean not null default false,
  result_counts jsonb,
  created_at timestamptz not null default now()
);
create index search_logs_created_idx on public.search_logs (created_at desc);

create table public.search_cache (
  normalized_query text primary key,
  parsed jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger team_posts_touch before update on public.team_posts for each row execute function public.touch_updated_at();
create trigger seeker_posts_touch before update on public.seeker_posts for each row execute function public.touch_updated_at();
create trigger cofounder_posts_touch before update on public.cofounder_posts for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_metrics enable row level security;
alter table public.saved_events enable row level security;
alter table public.team_posts enable row level security;
alter table public.team_members enable row level security;
alter table public.seeker_posts enable row level security;
alter table public.cofounder_posts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.broadcasts enable row level security;
alter table public.search_logs enable row level security;
alter table public.search_cache enable row level security;

create policy "own profile readable" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "published events readable" on public.events
  for select to anon, authenticated using (status = 'published');

create or replace function public.is_conversation_member(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
     where conversation_id = conv and user_id = (select auth.uid())
  )
$$;
revoke execute on function public.is_conversation_member(uuid) from anon, public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

create policy "members read conversations" on public.conversations
  for select to authenticated using (public.is_conversation_member(id));

create policy "members read participants" on public.conversation_participants
  for select to authenticated using (user_id = (select auth.uid()));

create policy "members read messages" on public.messages
  for select to authenticated using (public.is_conversation_member(conversation_id));

-- Realtime for chat
alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('posters', 'posters', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('attachments', 'attachments', false, 10485760, null)
on conflict (id) do nothing;
