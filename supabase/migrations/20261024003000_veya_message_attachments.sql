alter table public.veya_messages add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists idx_veya_messages_metadata_gin on public.veya_messages using gin (metadata);
