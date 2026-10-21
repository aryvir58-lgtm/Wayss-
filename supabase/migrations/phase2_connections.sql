-- Phase 2: incoming connection requests can be accepted by the target user.
create policy "update incoming connection" on public.connections
for update using (following_id = auth.uid()) with check (following_id = auth.uid());
