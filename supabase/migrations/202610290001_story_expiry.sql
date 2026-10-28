-- WAYSS stories are stored in public.posts with kind='story'.
-- Replace the previous kind check so story inserts are accepted.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.posts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.posts drop constraint %I', constraint_row.conname);
  end loop;
  alter table public.posts
    add constraint posts_kind_check
    check (kind in ('echo', 'signal', 'glimpse', 'flux', 'story'));
end $$;

-- Expired stories are filtered by the app. This index keeps story expiry queries efficient.
create index if not exists posts_story_expiry_idx
  on public.posts (expires_at)
  where kind = 'story';
