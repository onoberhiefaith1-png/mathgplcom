grant select on public.sessions to anon;

drop policy if exists "Audience links read open sessions" on public.sessions;
create policy "Audience links read open sessions"
on public.sessions for select to anon
using (status in ('published', 'live', 'ended'));

grant execute on function public.lookup_session_by_code(text) to anon;