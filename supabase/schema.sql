-- WAYSS Supabase foundation schema.
-- Run this in Supabase SQL Editor. It is intentionally focused on the core social model.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text default '',
  avatar_url text,
  is_private boolean not null default false,
  active_status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connections (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('echo','signal','glimpse','flux','story')),
  body text,
  media_url text,
  audience text not null default 'public' check (audience in ('public','connections','private')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,post_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.blocks enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.saved_posts enable row level security;
alter table public.notifications enable row level security;

create policy "profiles readable" on public.profiles for select using (
  not is_private or id = auth.uid() or exists (
    select 1 from public.connections c
    where c.follower_id = auth.uid() and c.following_id = profiles.id and c.status='accepted'
  )
);
create policy "own profile insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "connections visible to participants" on public.connections for select using (follower_id=auth.uid() or following_id=auth.uid());
create policy "create own connection" on public.connections for insert with check (follower_id=auth.uid());
create policy "delete own connection" on public.connections for delete using (follower_id=auth.uid() or following_id=auth.uid());

create policy "blocks visible to blocker" on public.blocks for select using (blocker_id=auth.uid());
create policy "create own block" on public.blocks for insert with check (blocker_id=auth.uid());
create policy "remove own block" on public.blocks for delete using (blocker_id=auth.uid());

create policy "posts readable when allowed" on public.posts for select using (
  author_id = auth.uid()
  or audience='public'
  or (audience='connections' and exists (
    select 1 from public.connections c
    where c.follower_id=auth.uid() and c.following_id=posts.author_id and c.status='accepted'
  ))
);
create policy "create own posts" on public.posts for insert with check (author_id=auth.uid());
create policy "update own posts" on public.posts for update using (author_id=auth.uid()) with check (author_id=auth.uid());
create policy "delete own posts" on public.posts for delete using (author_id=auth.uid());

create policy "likes readable" on public.post_likes for select using (true);
create policy "own like insert" on public.post_likes for insert with check (user_id=auth.uid());
create policy "own like delete" on public.post_likes for delete using (user_id=auth.uid());

create policy "comments readable" on public.comments for select using (true);
create policy "own comment insert" on public.comments for insert with check (author_id=auth.uid());
create policy "own comment update" on public.comments for update using (author_id=auth.uid()) with check (author_id=auth.uid());
create policy "own comment delete" on public.comments for delete using (author_id=auth.uid());

create policy "own saves" on public.saved_posts for select using (user_id=auth.uid());
create policy "own save insert" on public.saved_posts for insert with check (user_id=auth.uid());
create policy "own save delete" on public.saved_posts for delete using (user_id=auth.uid());

create policy "own notifications" on public.notifications for select using (recipient_id=auth.uid());
create policy "own notification update" on public.notifications for update using (recipient_id=auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, display_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name',''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
