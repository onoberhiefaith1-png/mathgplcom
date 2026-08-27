-- Assignment timer: optional per-question timed attempts.
-- Additive only. Permanent achievement stays in assessment_progress.

alter table public.assessments
  add column if not exists timer_enabled boolean not null default false,
  add column if not exists opens_at timestamptz,
  add column if not exists closes_at timestamptz;

create table if not exists public.assessment_timer_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null,
  question_id text not null,
  attempt_no integer not null default 1,
  started_at timestamptz,
  elapsed_ms bigint not null default 0,
  running boolean not null default false,
  attempt_lines jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  success boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id, question_id, attempt_no)
);

create index if not exists assessment_timer_attempts_board_idx
  on public.assessment_timer_attempts (assessment_id, student_id, question_id, attempt_no desc);

create index if not exists assessment_timer_attempts_best_idx
  on public.assessment_timer_attempts (assessment_id, question_id, success, elapsed_ms);

grant select, insert, update, delete on public.assessment_timer_attempts to authenticated;
grant all on public.assessment_timer_attempts to service_role;

alter table public.assessment_timer_attempts enable row level security;

create policy "Students manage their own timer attempts"
  on public.assessment_timer_attempts
  for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "Class owners read timer attempts for their assignments"
  on public.assessment_timer_attempts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assessments a
      join public.classes c on c.id = a.class_id
      where a.id = assessment_timer_attempts.assessment_id
        and c.owner_id = auth.uid()
    )
  );