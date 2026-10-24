-- Allow private profiles to be discoverable so people can send follow requests.
-- Post visibility remains protected separately by the "posts readable when allowed" RLS policy.
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (
    active_status = true
    and not exists (
      select 1
      from public.blocked_users b
      where b.blocked_by = (select auth.uid())
        and b.blocked_id = profiles.id
    )
  )
);
