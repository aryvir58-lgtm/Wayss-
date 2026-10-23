drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated using ((id = (select auth.uid())) or (active_status = true));

drop policy if exists "comment post owner delete" on public.comments;
create policy "comment post owner delete" on public.comments for delete to authenticated using (exists (select 1 from public.posts p where p.id = comments.post_id and p.author_id = (select auth.uid())));
