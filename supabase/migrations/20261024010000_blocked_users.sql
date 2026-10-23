create table if not exists public.blocked_users (
  blocked_by uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocked_by, blocked_id),
  constraint blocked_users_no_self_block check (blocked_by <> blocked_id)
);
alter table public.blocked_users enable row level security;
drop policy if exists "Users can view their own blocks" on public.blocked_users;
create policy "Users can view their own blocks" on public.blocked_users
for select to authenticated using (blocked_by = auth.uid());
drop policy if exists "Users can block others" on public.blocked_users;
create policy "Users can block others" on public.blocked_users
for insert to authenticated with check (blocked_by = auth.uid() and blocked_id <> auth.uid());
drop policy if exists "Users can unblock others" on public.blocked_users;
create policy "Users can unblock others" on public.blocked_users
for delete to authenticated using (blocked_by = auth.uid());
