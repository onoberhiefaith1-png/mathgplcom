create or replace function public.session_allows_free_entry(_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.allow_free_entry from public.sessions s where s.id = _session_id),
    false
  )
$$;

grant execute on function public.session_allows_free_entry(uuid) to anon, authenticated;

drop policy if exists "Audience joins an open session" on public.session_audience;

create policy "Audience joins an open session"
on public.session_audience
for insert
to anon, authenticated
with check (
  public.session_is_open(session_id)
  and (
    status = 'waiting'
    or (status = 'approved' and public.session_allows_free_entry(session_id))
  )
);