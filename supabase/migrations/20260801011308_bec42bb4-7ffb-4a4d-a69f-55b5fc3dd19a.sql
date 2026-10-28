alter table public.sessions add column if not exists ask_participant_name boolean not null default false;
alter table public.smart_cards add column if not exists ask_participant_name boolean not null default false;

grant select on public.sessions to anon;

drop policy if exists "Audience links read shared sessions" on public.sessions;
create policy "Audience links read shared sessions"
on public.sessions
for select
to anon
using (status = any (array['published','live','ended']));
