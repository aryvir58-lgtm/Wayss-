-- Prevent writing comments/likes to posts hidden by post-level RLS.
drop policy if exists "own comment insert" on public.comments;
create policy "own comment insert" on public.comments
for insert with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.posts p where p.id = comments.post_id)
);

drop policy if exists "own like insert" on public.post_likes;
create policy "own like insert" on public.post_likes
for insert with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.posts p where p.id = post_likes.post_id)
);

drop policy if exists "own notification update" on public.notifications;
create policy "own notification update" on public.notifications
for update using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));
