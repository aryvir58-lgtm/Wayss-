-- WAYSS Phase 3: comments + notifications + realtime
-- Run this once in Supabase SQL Editor.

create index if not exists comments_post_created_idx
  on public.comments(post_id, created_at desc);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);

-- Let the signed-in user create only their own notification is intentionally NOT allowed.
-- Notifications are created by SECURITY DEFINER triggers below.

create or replace function public.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(recipient_id, actor_id, type, payload)
  select p.author_id, new.user_id, 'post_like',
         jsonb_build_object('post_id', new.post_id)
  from public.posts p
  where p.id = new.post_id
    and p.author_id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists post_like_notification on public.post_likes;
create trigger post_like_notification
after insert on public.post_likes
for each row execute function public.notify_post_like();

create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(recipient_id, actor_id, type, payload)
  select p.author_id, new.author_id, 'post_comment',
         jsonb_build_object('post_id', new.post_id, 'comment_id', new.id, 'body', left(new.body, 140))
  from public.posts p
  where p.id = new.post_id
    and p.author_id <> new.author_id;
  return new;
end;
$$;

drop trigger if exists comment_notification on public.comments;
create trigger comment_notification
after insert on public.comments
for each row execute function public.notify_comment();

create or replace function public.notify_connection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications(recipient_id, actor_id, type, payload)
    values(new.following_id, new.follower_id, 'connection_request',
           jsonb_build_object('follower_id', new.follower_id));
  end if;
  return new;
end;
$$;

drop trigger if exists connection_notification on public.connections;
create trigger connection_notification
after insert on public.connections
for each row execute function public.notify_connection();

-- Enable realtime for Phase 3 tables without failing if they are already members.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    execute 'alter publication supabase_realtime add table public.comments';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;
