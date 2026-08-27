-- Session rows carry the private join code and the broadcasts column (meeting
-- links and credentials). Anonymous visitors and unrelated signed-in users must
-- never read those straight off the table: public/guest access goes only
-- through the sanitising `live_public_session` function.

-- 1. Anonymous audience links no longer read the base table at all.
drop policy if exists "Audience links read open sessions" on public.sessions;
revoke select on public.sessions from anon;

-- 2. Signed-in access is scoped to the room's owner and its class members;
--    being signed in is no longer enough to read another teacher's room.
drop policy if exists "Anyone signed in can view public published sessions" on public.sessions;

create policy "Owners and class members read sessions"
on public.sessions
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_class_member(class_id)
);

grant select on public.sessions to authenticated;