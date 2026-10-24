-- WAYSS verification, private identity documents, and admin account controls.
alter table public.profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists is_banned boolean not null default false;

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  real_name text not null check (char_length(trim(real_name)) between 2 and 160),
  reason text not null check (char_length(trim(reason)) between 20 and 3000),
  identity_file_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  decision_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists verification_requests_status_created_idx on public.verification_requests(status, created_at desc);
create index if not exists verification_requests_user_created_idx on public.verification_requests(user_id, created_at desc);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
alter table public.verification_requests enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "verification request owner read" on public.verification_requests;
create policy "verification request owner read" on public.verification_requests
for select to authenticated using (
  user_id = (select auth.uid())
  or (lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com' and coalesce((auth.jwt()->>'email_verified')::boolean,false))
);
drop policy if exists "verification request owner create" on public.verification_requests;
create policy "verification request owner create" on public.verification_requests
for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null
);
drop policy if exists "verification request admin update" on public.verification_requests;
create policy "verification request admin update" on public.verification_requests
for update to authenticated using (
  lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com' and coalesce((auth.jwt()->>'email_verified')::boolean,false)
) with check (
  lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com' and coalesce((auth.jwt()->>'email_verified')::boolean,false)
);
drop policy if exists "audit log admin read" on public.admin_audit_log;
create policy "audit log admin read" on public.admin_audit_log
for select to authenticated using (
  lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com' and coalesce((auth.jwt()->>'email_verified')::boolean,false)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-documents','verification-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "verification documents owner upload" on storage.objects;
create policy "verification documents owner upload" on storage.objects for insert to authenticated
with check (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "verification documents owner read" on storage.objects;
create policy "verification documents owner read" on storage.objects for select to authenticated using (
  bucket_id = 'verification-documents' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com' and coalesce((auth.jwt()->>'email_verified')::boolean,false))
  )
);
drop policy if exists "verification documents owner delete" on storage.objects;
create policy "verification documents owner delete" on storage.objects for delete to authenticated using (
  bucket_id = 'verification-documents' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com' and coalesce((auth.jwt()->>'email_verified')::boolean,false))
  )
);

-- The admin's badge is pre-enabled for the existing account, if it already exists.
update public.profiles p set is_verified = true
from auth.users u where p.id = u.id and lower(coalesce(u.email,'')) = 'vikashjagarwal08@gmail.com';

create or replace function public.protect_profile_admin_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.jwt()->>'role','') = 'service_role'
     or (lower(coalesce(auth.jwt()->>'email','')) = 'vikashjagarwal08@gmail.com' and coalesce((auth.jwt()->>'email_verified')::boolean,false)) then
    return new;
  end if;
  if new.is_verified is distinct from old.is_verified
     or new.is_suspended is distinct from old.is_suspended
     or new.is_banned is distinct from old.is_banned
     or new.active_status is distinct from old.active_status then
    raise exception 'Only WAYSS admin can change verification or account status.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_admin_fields_trigger on public.profiles;
create trigger protect_profile_admin_fields_trigger before update on public.profiles
for each row execute function public.protect_profile_admin_fields();
