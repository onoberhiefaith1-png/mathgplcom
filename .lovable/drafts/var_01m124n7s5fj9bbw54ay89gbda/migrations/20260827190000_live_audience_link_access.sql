-- MathGPL Live — make the invite link and Join Code work without an account.
--
-- The link itself is the credential: while a session is open (published or
-- live) an anonymous visitor may read that one session row and resolve a
-- Session Code. Nothing else about sessions is exposed.

grant select on public.sessions to anon;

drop policy if exists "Audience links read open sessions" on public.sessions;
create policy "Audience links read open sessions"
on public.sessions for select to anon
using (status in ('published', 'live', 'ended'));

grant execute on function public.lookup_session_by_code(text) to anon;
