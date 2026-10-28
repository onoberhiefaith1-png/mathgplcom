create or replace function public.student_may_access_owner(_student_id uuid, _owner_id uuid, _org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- An accepted school↔student or teacher↔student connection between them.
    exists (
      select 1 from public.connections c
      where c.status = 'accepted'
        and c.relation in ('school_student', 'teacher_student')
        and (
          (c.from_user_id = _owner_id and c.to_user_id = _student_id)
          or (c.from_user_id = _student_id and c.to_user_id = _owner_id)
        )
        and (_org_id is null or c.org_id is null or c.org_id = _org_id)
    )
    -- Or the student is already a member of a class this owner owns.
    or exists (
      select 1
      from public.class_members m
      join public.classes cl on cl.id = m.class_id
      where m.user_id = _student_id
        and cl.owner_id = _owner_id
        and (_org_id is null or cl.org_id is null or cl.org_id = _org_id)
    )
    -- Or the student belongs to the organisation being recorded.
    or exists (
      select 1 from public.account_memberships am
      where am.user_id = _student_id
        and _org_id is not null
        and am.org_id = _org_id
    );
$$;

revoke all on function public.student_may_access_owner(uuid, uuid, uuid) from public;
grant execute on function public.student_may_access_owner(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists "Students record their own workspace access" on public.student_workspace_access;

create policy "Students record their own workspace access"
on public.student_workspace_access
for insert
to authenticated
with check (
  student_id = auth.uid()
  and public.student_may_access_owner(auth.uid(), owner_id, org_id)
);