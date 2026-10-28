-- Optional Mathemagine identity. Does not grant MathGPL authoring roles.
create table if not exists public.mathemagine_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('student','teacher')),
 display_name text not null default 'Learner', created_at timestamptz not null default now()
);
alter table public.mathemagine_profiles enable row level security;
grant select,insert on public.mathemagine_profiles to authenticated;
create policy "mm self profile" on public.mathemagine_profiles for select to authenticated using(user_id=auth.uid());
create policy "mm register self" on public.mathemagine_profiles for insert to authenticated with check(user_id=auth.uid());
create table if not exists public.mathemagine_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('attempts','sessionAttempts','runs')), key text not null,
 value jsonb not null check(octet_length(value::text)<2000000), updated_at timestamptz not null default now(),
 primary key(user_id,kind,key)
);
alter table public.mathemagine_progress enable row level security;
grant select,insert,update on public.mathemagine_progress to authenticated;
create policy "mm private progress" on public.mathemagine_progress for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create table if not exists public.mathemagine_students (
 teacher_id uuid not null references public.mathemagine_profiles(user_id),
 student_id uuid not null references public.mathemagine_profiles(user_id),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(), primary key(teacher_id,student_id), check(teacher_id<>student_id)
);
alter table public.mathemagine_students enable row level security;
grant select,insert on public.mathemagine_students to authenticated;
grant update(status) on public.mathemagine_students to authenticated;
create policy "mm own connections" on public.mathemagine_students for select to authenticated using(teacher_id=auth.uid() or student_id=auth.uid());
create policy "mm teacher invites" on public.mathemagine_students for insert to authenticated with check(
 teacher_id=auth.uid() and status='pending' and exists(select 1 from public.mathemagine_profiles p where p.user_id=auth.uid() and p.role='teacher'));
create policy "mm student accepts" on public.mathemagine_students for update to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
create table if not exists public.mathemagine_assignments (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.mathemagine_profiles(user_id),
 student_id uuid not null references public.mathemagine_profiles(user_id), share_id uuid not null references public.arena_shares(id),
 student_code text not null, title text not null, created_at timestamptz not null default now()
);
alter table public.mathemagine_assignments enable row level security;
grant select,insert on public.mathemagine_assignments to authenticated;
create policy "mm own assignments" on public.mathemagine_assignments for select to authenticated using(teacher_id=auth.uid() or student_id=auth.uid());
create policy "mm assign accepted student" on public.mathemagine_assignments for insert to authenticated with check(
 teacher_id=auth.uid() and exists(select 1 from public.mathemagine_students s where s.teacher_id=auth.uid() and s.student_id=mathemagine_assignments.student_id and s.status='accepted')
 and exists(select 1 from public.arena_shares s where s.id=share_id and s.code=student_code and s.owner_id=auth.uid()));
-- Invite codes, rather than email searching, avoid exposing a directory of children.
create or replace function public.mathemagine_create_share(_session uuid,_title text,_entry jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare gc text; sc text; dc text; sid uuid;
begin
 if not exists(select 1 from mathemagine_profiles where user_id=auth.uid() and role='teacher') then raise exception 'Teacher account required'; end if;
 if not exists(select 1 from academia_sessions s join academia_subtopics st on st.id=s.subtopic_id join academia_topics t on t.id=st.topic_id join academia_subjects sj on sj.id=t.subject_id join academia_classes c on c.id=sj.class_id join academia a on a.id=c.academia_id where s.id=_session and a.visibility='public') then raise exception 'Public session required'; end if;
 if length(trim(_title)) not between 1 and 80 or coalesce(_entry->>'name','') not in ('off','optional','required') or coalesce(_entry->>'photo','') not in ('off','optional','required') then raise exception 'Invalid share settings'; end if;
 gc:='AC'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)); sc:='TA'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)); dc:='TD'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 insert into guest_links(owner_id,kind,resource_id,class_id,code,title,enabled,ask_name) values(auth.uid(),'academia_session',_session,null,gc,trim(_title),true,false);
 insert into arena_shares(owner_id,source_kind,source_id,guest_code,code,display_code,title,entry_config) values(auth.uid(),'academia_session',_session,gc,sc,dc,trim(_title),_entry) returning id into sid;
 return jsonb_build_object('id',sid,'code',sc,'display_code',dc,'title',trim(_title));
end $$;
revoke all on function public.mathemagine_create_share(uuid,text,jsonb) from public,anon;
grant execute on function public.mathemagine_create_share(uuid,text,jsonb) to authenticated;
-- Minimum-best promotion is atomic, so slower concurrent retries cannot overwrite faster times.
create or replace function public.arena_promote_best(_share uuid,_participant uuid,_assessment uuid,_question text,_ms bigint,_at timestamptz,_attempt uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into arena_bests(share_id,participant_id,assessment_id,question_id,best_ms,achieved_at,attempt_id)
 values(_share,_participant,_assessment,_question,_ms,_at,_attempt)
 on conflict(share_id,participant_id,assessment_id,question_id) do update set best_ms=excluded.best_ms,achieved_at=excluded.achieved_at,attempt_id=excluded.attempt_id where excluded.best_ms<arena_bests.best_ms;
 get diagnostics n=row_count; return n>0;
end $$;
revoke all on function public.arena_promote_best(uuid,uuid,uuid,text,bigint,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.arena_promote_best(uuid,uuid,uuid,text,bigint,timestamptz,uuid) to service_role;
alter table public.arena_participants add column if not exists avatar_photo text;
alter table public.arena_participants add column if not exists avatar_photo_at timestamptz;

create or replace function public.mathemagine_keep_newer() returns trigger language plpgsql set search_path=public as $$
begin if new.updated_at<old.updated_at then return null; end if; return new; end $$;
create trigger mathemagine_progress_newer before update on public.mathemagine_progress for each row execute function public.mathemagine_keep_newer();

-- A Mathemagine teacher may share a public Session, without gaining authoring rights.
create or replace function public.validate_academia_session_guest_link() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.kind='academia_session' then
  if new.class_id is not null then raise exception 'Academia session guest links cannot be class-scoped';end if;
  if not public.academia_can_build_subject(public.academia_subject_of_session(new.resource_id)) and not (
   new.owner_id=auth.uid() and exists(select 1 from mathemagine_profiles p where p.user_id=auth.uid() and p.role='teacher')
   and exists(select 1 from academia_sessions s join academia_subtopics st on st.id=s.subtopic_id join academia_topics t on t.id=st.topic_id join academia_subjects sj on sj.id=t.subject_id join academia_classes c on c.id=sj.class_id join academia a on a.id=c.academia_id where s.id=new.resource_id and a.visibility='public')
  ) then raise exception 'Not permitted to share this Academia session';end if;
 end if;
 return new;
end $$;
