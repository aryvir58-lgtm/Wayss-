-- Username sign-in helper for WAYSS. Resolves a public username to its auth email.
-- Only returns a value for an exact normalized username; password verification remains Supabase Auth's job.
create or replace function public.wayss_login_email_for_username(login_username text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(regexp_replace(trim(login_username), '^@', ''))
    and coalesce(p.active_status, true) = true
  limit 1;
$$;

revoke all on function public.wayss_login_email_for_username(text) from public;
grant execute on function public.wayss_login_email_for_username(text) to anon, authenticated;
