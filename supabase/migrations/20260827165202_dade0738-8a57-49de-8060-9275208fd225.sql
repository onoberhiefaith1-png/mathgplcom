create policy "Class members read timer attempts for their class"
  on public.assessment_timer_attempts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assessments a
      where a.id = assessment_timer_attempts.assessment_id
        and a.class_id is not null
        and public.is_class_member(a.class_id)
    )
  );

alter publication supabase_realtime add table public.assessment_timer_attempts;