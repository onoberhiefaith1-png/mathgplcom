-- Permanent verified achievements must survive two graders saving stale snapshots.
-- This does not grade expressions, award new slots, or alter attempt/reset records.
create or replace function public.merge_verified_progress_update()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  merged jsonb;
  earned numeric;
  required numeric;
begin
  select coalesce(jsonb_object_agg(slot, marks), '{}'::jsonb), coalesce(sum(marks), 0)
    into merged, earned
    from (
      select key as slot, max((value #>> '{}')::numeric) as marks
      from (
        select * from jsonb_each(case when jsonb_typeof(old.solved_lines) = 'object' then old.solved_lines else '{}'::jsonb end)
        union all
        select * from jsonb_each(case when jsonb_typeof(new.solved_lines) = 'object' then new.solved_lines else '{}'::jsonb end)
      ) values_by_slot
      where jsonb_typeof(value) = 'number' and (value #>> '{}')::numeric >= 0
      group by key
    ) distinct_marks;
  new.solved_lines := merged;
  new.score := earned;
  if tg_table_name = 'guest_attempts' then
    required := new.total_marks;
  else
    select total_marks into required from public.assessments where id = new.assessment_id;
  end if;
  new.status := case when required > 0 and earned >= required then 'completed' else 'in_progress' end;
  return new;
end;
$$;
revoke all on function public.merge_verified_progress_update() from public, anon, authenticated;
drop trigger if exists merge_verified_progress_update on public.guest_attempts;
create trigger merge_verified_progress_update before update of solved_lines on public.guest_attempts
for each row execute function public.merge_verified_progress_update();
drop trigger if exists merge_verified_progress_update on public.assessment_progress;
create trigger merge_verified_progress_update before update of solved_lines on public.assessment_progress
for each row execute function public.merge_verified_progress_update();
