create table public.academia_adventure_questions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.academia_activities(id) on delete cascade,
  scene_id text not null,
  bar_id text not null,
  position integer not null default 0,
  title text not null default '',
  question_text text,
  lines jsonb not null default '[]'::jsonb,
  objects jsonb,
  total_marks numeric not null default 0,
  notebook_id uuid,
  subsection_id uuid,
  question_key text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index academia_adventure_questions_slot on public.academia_adventure_questions(activity_id, scene_id, position);

create table public.academia_adventure_points (
  activity_id uuid not null references public.academia_activities(id) on delete cascade,
  scene_id text not null,
  pass_pct integer not null default 100,
  updated_at timestamptz not null default now(),
  primary key (activity_id, scene_id)
);

grant select, insert, update, delete on public.academia_adventure_questions to authenticated;
grant all on public.academia_adventure_questions to service_role;
grant select, insert, update, delete on public.academia_adventure_points to authenticated;
grant all on public.academia_adventure_points to service_role;

alter table public.academia_adventure_questions enable row level security;
alter table public.academia_adventure_points enable row level security;

create policy "view adventure questions" on public.academia_adventure_questions for select to authenticated
  using (exists (select 1 from public.academia_activities a where a.id = activity_id
    and public.academia_can_view_org(public.academia_org_of_subject(public.academia_subject_of_session(a.session_id)))));
create policy "build adventure questions" on public.academia_adventure_questions for all to authenticated
  using (exists (select 1 from public.academia_activities a where a.id = activity_id
    and public.academia_can_build_subject(public.academia_subject_of_session(a.session_id))))
  with check (exists (select 1 from public.academia_activities a where a.id = activity_id
    and public.academia_can_build_subject(public.academia_subject_of_session(a.session_id))));

create policy "view adventure points" on public.academia_adventure_points for select to authenticated
  using (exists (select 1 from public.academia_activities a where a.id = activity_id
    and public.academia_can_view_org(public.academia_org_of_subject(public.academia_subject_of_session(a.session_id)))));
create policy "build adventure points" on public.academia_adventure_points for all to authenticated
  using (exists (select 1 from public.academia_activities a where a.id = activity_id
    and public.academia_can_build_subject(public.academia_subject_of_session(a.session_id))))
  with check (exists (select 1 from public.academia_activities a where a.id = activity_id
    and public.academia_can_build_subject(public.academia_subject_of_session(a.session_id))));