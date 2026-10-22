-- Applied to the live WAYSS Supabase project on 2026-10-23.
-- Harden content visibility and prevent unauthorized conversation membership.
drop policy if exists "posts readable when allowed" on public.posts;
create policy "posts readable when allowed" on public.posts
for select using (
  author_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles author_profile
    where author_profile.id = posts.author_id
      and author_profile.active_status = true
      and (
        (author_profile.is_private = false and posts.audience = 'public')
        or (
          posts.audience in ('public', 'connections')
          and exists (
            select 1 from public.connections c
            where c.follower_id = (select auth.uid())
              and c.following_id = posts.author_id
              and c.status = 'accepted'
          )
        )
      )
  )
);

drop policy if exists "comments readable" on public.comments;
create policy "comments readable" on public.comments
for select using (
  exists (select 1 from public.posts p where p.id = comments.post_id)
);

drop policy if exists "likes readable" on public.post_likes;
create policy "likes readable" on public.post_likes
for select using (
  exists (select 1 from public.posts p where p.id = post_likes.post_id)
);

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
for select using (
  id = (select auth.uid())
  or (
    active_status = true
    and (
      is_private = false
      or exists (
        select 1 from public.connections c
        where c.follower_id = (select auth.uid())
          and c.following_id = profiles.id
          and c.status = 'accepted'
      )
    )
  )
);

drop policy if exists "conversation members insert" on public.conversation_members;
create policy "conversation members insert" on public.conversation_members
for insert with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.created_by = (select auth.uid())
  )
);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_comment() from public, anon, authenticated;
revoke execute on function public.notify_connection() from public, anon, authenticated;
revoke execute on function public.notify_post_like() from public, anon, authenticated;
