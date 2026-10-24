-- Align admin checks with Supabase's verified auth-user identity and support new admin accounts.
drop policy if exists "verification request owner read" on public.verification_requests;
create policy "verification request owner read" on public.verification_requests for select to authenticated using (
  user_id = (select auth.uid()) or lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com'
);
drop policy if exists "verification request admin update" on public.verification_requests;
create policy "verification request admin update" on public.verification_requests for update to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com')
with check (lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com');
drop policy if exists "verification request owner create" on public.verification_requests;
create policy "verification request owner create" on public.verification_requests for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null
  and identity_file_path like ((select auth.uid())::text || '/%')
);
drop policy if exists "audit log admin read" on public.admin_audit_log;
create policy "audit log admin read" on public.admin_audit_log for select to authenticated using (
  lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com'
);
drop policy if exists "verification documents owner read" on storage.objects;
create policy "verification documents owner read" on storage.objects for select to authenticated using (
  bucket_id = 'verification-documents' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com'
  )
);
drop policy if exists "verification documents owner delete" on storage.objects;
create policy "verification documents owner delete" on storage.objects for delete to authenticated using (
  bucket_id = 'verification-documents' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com'
  )
);
create or replace function public.protect_profile_admin_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.jwt()->>'role','') = 'service_role'
     or lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com' then return new; end if;
  if new.is_verified is distinct from old.is_verified
     or new.is_suspended is distinct from old.is_suspended
     or new.is_banned is distinct from old.is_banned
     or new.active_status is distinct from old.active_status then
    raise exception 'Only WAYSS admin can change verification or account status.';
  end if;
  return new;
end;
$$;
create or replace function public.auto_verify_wayss_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from auth.users u where u.id = new.id and lower(coalesce(u.email,'')) = 'vikashjagarwal08@gmail.com') then
    new.is_verified := true;
  end if;
  return new;
end;
$$;
drop trigger if exists auto_verify_wayss_admin_trigger on public.profiles;
create trigger auto_verify_wayss_admin_trigger before insert on public.profiles for each row execute function public.auto_verify_wayss_admin();
revoke execute on function public.auto_verify_wayss_admin() from public, anon, authenticated;
