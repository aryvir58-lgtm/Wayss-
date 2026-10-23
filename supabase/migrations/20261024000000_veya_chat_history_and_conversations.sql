create table if not exists public.veya_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.veya_messages add column if not exists conversation_id uuid;

insert into public.veya_chats (user_id,title,created_at,updated_at)
select user_id,'Veya chat',min(created_at),max(created_at)
from public.veya_messages
where conversation_id is null
group by user_id
having count(*) > 0;

update public.veya_messages m
set conversation_id=c.id
from public.veya_chats c
where m.user_id=c.user_id and m.conversation_id is null;

alter table public.veya_messages alter column conversation_id set not null;
alter table public.veya_messages drop constraint if exists veya_messages_conversation_id_fkey;
alter table public.veya_messages add constraint veya_messages_conversation_id_fkey foreign key (conversation_id) references public.veya_chats(id) on delete cascade;

create index if not exists idx_veya_chats_user_updated on public.veya_chats(user_id,updated_at desc);
create index if not exists idx_veya_messages_conversation_created on public.veya_messages(conversation_id,created_at asc);

alter table public.veya_chats enable row level security;
drop policy if exists "Users manage own Veya chats" on public.veya_chats;
create policy "Users manage own Veya chats" on public.veya_chats
for all to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists "Users manage own Veya messages" on public.veya_messages;
create policy "Users manage own Veya messages" on public.veya_messages
for all to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
