
CREATE OR REPLACE FUNCTION public.staff_is_admin(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM organizations o WHERE o.id=_org AND o.kind='school' AND o.owner_user_id=auth.uid())
      OR EXISTS (SELECT 1 FROM account_memberships m JOIN organizations o ON o.id=m.org_id
                 WHERE m.org_id=_org AND o.kind='school' AND m.user_id=auth.uid() AND m.role='school' AND m.status='active')
$$;
CREATE OR REPLACE FUNCTION public.staff_is_member(_org uuid, _user uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM account_memberships m JOIN organizations o ON o.id=m.org_id
                 WHERE m.org_id=_org AND o.kind='school' AND m.user_id=_user AND m.role='teacher' AND m.status='active')
$$;

CREATE TABLE public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'manager' CHECK (role IN ('manager')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT ON public.staff_roles TO authenticated;
GRANT ALL ON public.staff_roles TO service_role;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.staff_is_manager(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.staff_is_admin(_org) OR (public.staff_is_member(_org) AND EXISTS (
    SELECT 1 FROM staff_roles r WHERE r.org_id=_org AND r.user_id=auth.uid()))
$$;
CREATE OR REPLACE FUNCTION public.staff_can_view(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.staff_is_manager(_org) OR public.staff_is_member(_org)
$$;
CREATE POLICY "staff roles visible in school" ON public.staff_roles FOR SELECT TO authenticated USING (public.staff_can_view(org_id));

CREATE TABLE public.staff_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, description text, status text NOT NULL DEFAULT 'active',
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.staff_projects(id) ON DELETE SET NULL,
  title text NOT NULL, description text, target_date date, status text NOT NULL DEFAULT 'active',
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_projects, public.staff_goals TO authenticated;
GRANT ALL ON public.staff_projects, public.staff_goals TO service_role;
ALTER TABLE public.staff_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view projects" ON public.staff_projects FOR SELECT TO authenticated USING (public.staff_can_view(org_id));
CREATE POLICY "manage projects" ON public.staff_projects FOR ALL TO authenticated USING (public.staff_is_manager(org_id)) WITH CHECK (public.staff_is_manager(org_id));
CREATE POLICY "view goals" ON public.staff_goals FOR SELECT TO authenticated USING (public.staff_can_view(org_id));
CREATE POLICY "manage goals" ON public.staff_goals FOR ALL TO authenticated USING (public.staff_is_manager(org_id)) WITH CHECK (public.staff_is_manager(org_id));

CREATE TABLE public.staff_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  deadline timestamptz,
  deadline_kind text NOT NULL DEFAULT 'datetime' CHECK (deadline_kind IN ('date','datetime','flexible')),
  estimated_hours numeric NOT NULL DEFAULT 1,
  evidence_required boolean NOT NULL DEFAULT true,
  review_required boolean NOT NULL DEFAULT true,
  project_id uuid REFERENCES public.staff_projects(id) ON DELETE SET NULL,
  goal_id uuid REFERENCES public.staff_goals(id) ON DELETE SET NULL,
  link_kind text CHECK (link_kind IN ('academia_session','lesson_note','game','assessment','url')),
  link_id text,
  link_label text,
  is_template boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.staff_tasks (org_id);
CREATE TABLE public.staff_task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','submitted','changes_requested','completed')),
  deadline timestamptz,
  started_at timestamptz, submitted_at timestamptz, completed_at timestamptz,
  review_rounds int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
CREATE INDEX ON public.staff_task_assignees (org_id);
CREATE INDEX ON public.staff_task_assignees (user_id);
CREATE TABLE public.staff_task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee_id uuid NOT NULL REFERENCES public.staff_task_assignees(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  links text[] NOT NULL DEFAULT '{}',
  files jsonb NOT NULL DEFAULT '[]',
  decision text CHECK (decision IN ('approved','changes_requested')),
  review_note text, reviewed_by uuid, reviewed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee_id uuid NOT NULL REFERENCES public.staff_task_assignees(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  requested_deadline timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decided_by uuid, decided_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  week_start date NOT NULL,
  worker_type text NOT NULL DEFAULT 'full_time' CHECK (worker_type IN ('full_time','part_time','contract','flexible')),
  hours numeric NOT NULL DEFAULT 0,
  days jsonb NOT NULL DEFAULT '{}',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested')),
  review_note text, reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, week_start)
);
CREATE TABLE public.staff_work_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  task_id uuid REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  subject_user_id uuid,
  actor_id uuid DEFAULT auth.uid(),
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.staff_work_events (org_id, created_at DESC);

GRANT SELECT ON public.staff_tasks, public.staff_task_assignees, public.staff_task_submissions, public.staff_task_comments, public.staff_extension_requests, public.staff_availability, public.staff_work_events TO authenticated;
GRANT ALL ON public.staff_tasks, public.staff_task_assignees, public.staff_task_submissions, public.staff_task_comments, public.staff_extension_requests, public.staff_availability, public.staff_work_events TO service_role;
ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_extension_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_work_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.staff_is_assigned(_task uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM staff_task_assignees a WHERE a.task_id=_task AND a.user_id=auth.uid())
$$;
CREATE POLICY "tasks: managers or assignees" ON public.staff_tasks FOR SELECT TO authenticated
  USING (public.staff_is_manager(org_id) OR (public.staff_is_member(org_id) AND public.staff_is_assigned(id)));
CREATE POLICY "assignees: managers or self" ON public.staff_task_assignees FOR SELECT TO authenticated
  USING (public.staff_is_manager(org_id) OR (user_id=auth.uid() AND public.staff_is_member(org_id)));
CREATE POLICY "submissions: managers or self" ON public.staff_task_submissions FOR SELECT TO authenticated
  USING (public.staff_is_manager(org_id) OR created_by=auth.uid());
CREATE POLICY "comments: task viewers" ON public.staff_task_comments FOR SELECT TO authenticated
  USING (public.staff_is_manager(org_id) OR public.staff_is_assigned(task_id));
CREATE POLICY "extensions: managers or self" ON public.staff_extension_requests FOR SELECT TO authenticated
  USING (public.staff_is_manager(org_id) OR created_by=auth.uid());
CREATE POLICY "availability: managers or self" ON public.staff_availability FOR SELECT TO authenticated
  USING (public.staff_is_manager(org_id) OR user_id=auth.uid());
CREATE POLICY "events: managers or own" ON public.staff_work_events FOR SELECT TO authenticated
  USING (public.staff_is_manager(org_id) OR subject_user_id=auth.uid());

-- internal helpers
CREATE OR REPLACE FUNCTION public.staff_log(_org uuid, _task uuid, _subject uuid, _kind text, _detail jsonb DEFAULT '{}') RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO staff_work_events(org_id, task_id, subject_user_id, actor_id, kind, detail) VALUES (_org,_task,_subject,auth.uid(),_kind,_detail)
$$;
CREATE OR REPLACE FUNCTION public.staff_notify(_users uuid[], _subject text, _body text, _path text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE nid uuid; u uuid; n int := 0;
BEGIN
  IF _users IS NULL OR array_length(_users,1) IS NULL THEN RETURN; END IF;
  INSERT INTO notifications(kind, sender_user_id, subject, body, category, target_path, allow_responses, context)
  VALUES ('system', auth.uid(), _subject, _body, 'update', _path, false, jsonb_build_object('source','staff_hub'))
  RETURNING id INTO nid;
  FOREACH u IN ARRAY _users LOOP
    IF u IS NOT NULL AND u <> auth.uid() THEN
      INSERT INTO notification_recipients(notification_id, recipient_user_id) VALUES (nid, u); n := n+1;
    END IF;
  END LOOP;
  UPDATE notifications SET recipient_count=n WHERE id=nid;
END $$;
CREATE OR REPLACE FUNCTION public.staff_manager_ids(_org uuid) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT array_agg(DISTINCT x) FROM (
    SELECT owner_user_id x FROM organizations WHERE id=_org
    UNION SELECT user_id FROM staff_roles WHERE org_id=_org
  ) s WHERE x IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.staff_log(uuid,uuid,uuid,text,jsonb), public.staff_notify(uuid[],text,text,text), public.staff_manager_ids(uuid) FROM PUBLIC, anon, authenticated;

-- team
CREATE OR REPLACE FUNCTION public.staff_team(_org uuid) RETURNS TABLE(user_id uuid, display_name text, avatar_url text, mathgpl_id text, is_manager boolean, is_admin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.staff_can_view(_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY
  SELECT m.user_id, COALESCE(NULLIF(p.display_name,''), 'Teacher')::text, p.avatar_url::text, ai.mathgpl_id::text,
         EXISTS (SELECT 1 FROM staff_roles r WHERE r.org_id=_org AND r.user_id=m.user_id), false
  FROM account_memberships m
  LEFT JOIN profiles p ON p.id=m.user_id
  LEFT JOIN LATERAL (SELECT a.mathgpl_id FROM account_ids a WHERE a.user_id=m.user_id LIMIT 1) ai ON true
  WHERE m.org_id=_org AND m.role='teacher' AND m.status='active'
  ORDER BY 2;
END $$;

CREATE OR REPLACE FUNCTION public.staff_set_manager(_org uuid, _user uuid, _on boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.staff_is_admin(_org) THEN RAISE EXCEPTION 'Only the school owner can change managers'; END IF;
  IF NOT public.staff_is_member(_org, _user) THEN RAISE EXCEPTION 'That teacher is not connected to this school'; END IF;
  IF _on THEN
    INSERT INTO staff_roles(org_id,user_id,created_by) VALUES (_org,_user,auth.uid()) ON CONFLICT DO NOTHING;
    PERFORM staff_notify(ARRAY[_user], 'You are now a Staff Hub manager', 'You can assign and review school tasks.', '/staff-hub');
  ELSE
    DELETE FROM staff_roles WHERE org_id=_org AND user_id=_user;
  END IF;
  PERFORM staff_log(_org, NULL, _user, CASE WHEN _on THEN 'manager_granted' ELSE 'manager_removed' END);
END $$;

-- tasks
CREATE OR REPLACE FUNCTION public.staff_create_task(_org uuid, _task jsonb, _assignees uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tid uuid; u uuid; dl timestamptz; tmpl boolean;
BEGIN
  IF NOT public.staff_is_manager(_org) THEN RAISE EXCEPTION 'Only the school owner or a manager can assign tasks'; END IF;
  IF COALESCE(trim(_task->>'title'),'')='' THEN RAISE EXCEPTION 'A task needs a title'; END IF;
  dl := NULLIF(_task->>'deadline','')::timestamptz;
  tmpl := COALESCE((_task->>'is_template')::boolean,false);
  INSERT INTO staff_tasks(org_id,title,instructions,priority,deadline,deadline_kind,estimated_hours,evidence_required,review_required,
    project_id,goal_id,link_kind,link_id,link_label,is_template)
  VALUES (_org, trim(_task->>'title'), COALESCE(_task->>'instructions',''), COALESCE(_task->>'priority','medium'), dl,
    COALESCE(_task->>'deadline_kind','datetime'), COALESCE(NULLIF(_task->>'estimated_hours','')::numeric,1),
    COALESCE((_task->>'evidence_required')::boolean,true), COALESCE((_task->>'review_required')::boolean,true),
    NULLIF(_task->>'project_id','')::uuid, NULLIF(_task->>'goal_id','')::uuid,
    NULLIF(_task->>'link_kind',''), NULLIF(_task->>'link_id',''), NULLIF(_task->>'link_label',''), tmpl)
  RETURNING id INTO tid;
  IF NOT tmpl AND _assignees IS NOT NULL THEN
    FOREACH u IN ARRAY _assignees LOOP
      IF NOT public.staff_is_member(_org,u) THEN RAISE EXCEPTION 'Tasks can only go to teachers connected to this school'; END IF;
      INSERT INTO staff_task_assignees(task_id,org_id,user_id,deadline) VALUES (tid,_org,u,dl) ON CONFLICT DO NOTHING;
    END LOOP;
    PERFORM staff_notify(_assignees, 'New school task', trim(_task->>'title'), '/staff-hub?task='||tid);
  END IF;
  PERFORM staff_log(_org, tid, NULL, CASE WHEN tmpl THEN 'template_created' ELSE 'task_assigned' END, jsonb_build_object('assignees', COALESCE(to_jsonb(_assignees),'[]')));
  RETURN tid;
END $$;

CREATE OR REPLACE FUNCTION public.staff_delete_task(_task uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o uuid;
BEGIN
  SELECT org_id INTO o FROM staff_tasks WHERE id=_task;
  IF o IS NULL OR NOT public.staff_is_manager(o) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM staff_tasks WHERE id=_task;
  PERFORM staff_log(o, NULL, NULL, 'task_deleted', jsonb_build_object('task_id',_task));
END $$;

CREATE OR REPLACE FUNCTION public.staff_change_deadline(_task uuid, _deadline timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o uuid; users uuid[];
BEGIN
  SELECT org_id INTO o FROM staff_tasks WHERE id=_task;
  IF o IS NULL OR NOT public.staff_is_manager(o) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE staff_tasks SET deadline=_deadline, updated_at=now() WHERE id=_task;
  UPDATE staff_task_assignees SET deadline=_deadline, updated_at=now() WHERE task_id=_task AND status<>'completed';
  SELECT array_agg(user_id) INTO users FROM staff_task_assignees WHERE task_id=_task;
  PERFORM staff_notify(users, 'Deadline changed', 'A school task has a new deadline.', '/staff-hub?task='||_task);
  PERFORM staff_log(o, _task, NULL, 'deadline_changed', jsonb_build_object('deadline',_deadline));
END $$;

CREATE OR REPLACE FUNCTION public.staff_add_assignees(_task uuid, _users uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t staff_tasks; u uuid;
BEGIN
  SELECT * INTO t FROM staff_tasks WHERE id=_task;
  IF t.id IS NULL OR NOT public.staff_is_manager(t.org_id) OR t.is_template THEN RAISE EXCEPTION 'Not allowed'; END IF;
  FOREACH u IN ARRAY _users LOOP
    IF NOT public.staff_is_member(t.org_id,u) THEN RAISE EXCEPTION 'Tasks can only go to teachers connected to this school'; END IF;
    INSERT INTO staff_task_assignees(task_id,org_id,user_id,deadline) VALUES (_task,t.org_id,u,t.deadline) ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM staff_notify(_users, 'New school task', t.title, '/staff-hub?task='||_task);
  PERFORM staff_log(t.org_id, _task, NULL, 'task_assigned', jsonb_build_object('assignees', to_jsonb(_users)));
END $$;

CREATE OR REPLACE FUNCTION public.staff_start_task(_assignee uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a staff_task_assignees;
BEGIN
  SELECT * INTO a FROM staff_task_assignees WHERE id=_assignee;
  IF a.id IS NULL OR a.user_id<>auth.uid() THEN RAISE EXCEPTION 'Not your task'; END IF;
  IF a.status NOT IN ('assigned','changes_requested') THEN RETURN; END IF;
  UPDATE staff_task_assignees SET status='in_progress', started_at=COALESCE(started_at,now()), updated_at=now() WHERE id=_assignee;
  PERFORM staff_log(a.org_id, a.task_id, a.user_id, 'task_started');
END $$;

CREATE OR REPLACE FUNCTION public.staff_submit_task(_assignee uuid, _note text, _links text[], _files jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a staff_task_assignees; t staff_tasks;
BEGIN
  SELECT * INTO a FROM staff_task_assignees WHERE id=_assignee;
  IF a.id IS NULL OR a.user_id<>auth.uid() THEN RAISE EXCEPTION 'Not your task'; END IF;
  SELECT * INTO t FROM staff_tasks WHERE id=a.task_id;
  IF t.evidence_required AND COALESCE(trim(_note),'')='' AND COALESCE(array_length(_links,1),0)=0 AND COALESCE(jsonb_array_length(_files),0)=0 THEN
    RAISE EXCEPTION 'This task needs proof: add a note, a link or a file';
  END IF;
  INSERT INTO staff_task_submissions(assignee_id,org_id,note,links,files) VALUES (_assignee,a.org_id,COALESCE(_note,''),COALESCE(_links,'{}'),COALESCE(_files,'[]'));
  IF t.review_required THEN
    UPDATE staff_task_assignees SET status='submitted', submitted_at=now(), started_at=COALESCE(started_at,now()), updated_at=now() WHERE id=_assignee;
    PERFORM staff_notify(staff_manager_ids(a.org_id), 'Task submitted for review', t.title, '/staff-hub?task='||t.id);
  ELSE
    UPDATE staff_task_assignees SET status='completed', submitted_at=now(), completed_at=now(), started_at=COALESCE(started_at,now()), updated_at=now() WHERE id=_assignee;
    PERFORM staff_notify(staff_manager_ids(a.org_id), 'Task completed', t.title, '/staff-hub?task='||t.id);
  END IF;
  PERFORM staff_log(a.org_id, a.task_id, a.user_id, 'task_submitted', jsonb_build_object('on_time', a.deadline IS NULL OR now()<=a.deadline));
END $$;

CREATE OR REPLACE FUNCTION public.staff_review_task(_assignee uuid, _approve boolean, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a staff_task_assignees; t staff_tasks;
BEGIN
  SELECT * INTO a FROM staff_task_assignees WHERE id=_assignee;
  IF a.id IS NULL OR NOT public.staff_is_manager(a.org_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF a.status<>'submitted' THEN RAISE EXCEPTION 'Nothing waiting for review'; END IF;
  SELECT * INTO t FROM staff_tasks WHERE id=a.task_id;
  UPDATE staff_task_submissions SET decision=CASE WHEN _approve THEN 'approved' ELSE 'changes_requested' END,
    review_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
  WHERE id=(SELECT id FROM staff_task_submissions WHERE assignee_id=_assignee ORDER BY created_at DESC LIMIT 1);
  UPDATE staff_task_assignees SET status=CASE WHEN _approve THEN 'completed' ELSE 'changes_requested' END,
    completed_at=CASE WHEN _approve THEN now() END, review_rounds=review_rounds+1, updated_at=now() WHERE id=_assignee;
  PERFORM staff_notify(ARRAY[a.user_id], CASE WHEN _approve THEN 'Task approved' ELSE 'Changes requested' END, t.title||COALESCE(': '||NULLIF(_note,''),''), '/staff-hub?task='||t.id);
  PERFORM staff_log(a.org_id, a.task_id, a.user_id, CASE WHEN _approve THEN 'task_approved' ELSE 'changes_requested' END, jsonb_build_object('note',_note));
END $$;

CREATE OR REPLACE FUNCTION public.staff_request_extension(_assignee uuid, _deadline timestamptz, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a staff_task_assignees;
BEGIN
  SELECT * INTO a FROM staff_task_assignees WHERE id=_assignee;
  IF a.id IS NULL OR a.user_id<>auth.uid() THEN RAISE EXCEPTION 'Not your task'; END IF;
  IF EXISTS (SELECT 1 FROM staff_extension_requests WHERE assignee_id=_assignee AND status='pending') THEN RAISE EXCEPTION 'You already have a request waiting'; END IF;
  INSERT INTO staff_extension_requests(assignee_id,org_id,requested_deadline,reason) VALUES (_assignee,a.org_id,_deadline,COALESCE(_reason,''));
  PERFORM staff_notify(staff_manager_ids(a.org_id), 'More time requested', COALESCE(NULLIF(_reason,''),'A teacher asked for more time.'), '/staff-hub?task='||a.task_id);
  PERFORM staff_log(a.org_id, a.task_id, a.user_id, 'extension_requested', jsonb_build_object('deadline',_deadline));
END $$;

CREATE OR REPLACE FUNCTION public.staff_decide_extension(_request uuid, _approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r staff_extension_requests; a staff_task_assignees;
BEGIN
  SELECT * INTO r FROM staff_extension_requests WHERE id=_request;
  IF r.id IS NULL OR NOT public.staff_is_manager(r.org_id) OR r.status<>'pending' THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO a FROM staff_task_assignees WHERE id=r.assignee_id;
  UPDATE staff_extension_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'declined' END, decided_by=auth.uid(), decided_at=now() WHERE id=_request;
  IF _approve THEN UPDATE staff_task_assignees SET deadline=r.requested_deadline, updated_at=now() WHERE id=a.id; END IF;
  PERFORM staff_notify(ARRAY[a.user_id], CASE WHEN _approve THEN 'More time approved' ELSE 'More time declined' END, 'Your extension request was answered.', '/staff-hub?task='||a.task_id);
  PERFORM staff_log(r.org_id, a.task_id, a.user_id, CASE WHEN _approve THEN 'extension_approved' ELSE 'extension_declined' END);
END $$;

CREATE OR REPLACE FUNCTION public.staff_add_comment(_task uuid, _body text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t staff_tasks; users uuid[];
BEGIN
  SELECT * INTO t FROM staff_tasks WHERE id=_task;
  IF t.id IS NULL OR NOT (public.staff_is_manager(t.org_id) OR public.staff_is_assigned(_task)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF COALESCE(trim(_body),'')='' THEN RETURN; END IF;
  INSERT INTO staff_task_comments(task_id,org_id,body) VALUES (_task,t.org_id,trim(_body));
  SELECT array_agg(DISTINCT x) INTO users FROM (SELECT user_id x FROM staff_task_assignees WHERE task_id=_task UNION SELECT unnest(staff_manager_ids(t.org_id))) s;
  PERFORM staff_notify(users, 'New comment on a task', t.title, '/staff-hub?task='||_task);
END $$;

-- availability
CREATE OR REPLACE FUNCTION public.staff_submit_availability(_org uuid, _week date, _worker_type text, _hours numeric, _days jsonb, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.staff_is_member(_org) THEN RAISE EXCEPTION 'Only connected teachers submit availability'; END IF;
  INSERT INTO staff_availability(org_id,user_id,week_start,worker_type,hours,days,note)
  VALUES (_org,auth.uid(),_week,_worker_type,COALESCE(_hours,0),COALESCE(_days,'{}'),COALESCE(_note,''))
  ON CONFLICT (org_id,user_id,week_start) DO UPDATE SET worker_type=EXCLUDED.worker_type, hours=EXCLUDED.hours, days=EXCLUDED.days,
    note=EXCLUDED.note, status='pending', review_note=NULL, reviewed_by=NULL, reviewed_at=NULL, updated_at=now();
  PERFORM staff_notify(staff_manager_ids(_org), 'Availability submitted', 'A teacher submitted availability for the week of '||_week, '/staff-hub?tab=availability');
  PERFORM staff_log(_org, NULL, auth.uid(), 'availability_submitted', jsonb_build_object('week',_week,'hours',_hours));
END $$;

CREATE OR REPLACE FUNCTION public.staff_review_availability(_id uuid, _approve boolean, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r staff_availability;
BEGIN
  SELECT * INTO r FROM staff_availability WHERE id=_id;
  IF r.id IS NULL OR NOT public.staff_is_manager(r.org_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE staff_availability SET status=CASE WHEN _approve THEN 'approved' ELSE 'changes_requested' END, review_note=_note, reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() WHERE id=_id;
  PERFORM staff_notify(ARRAY[r.user_id], CASE WHEN _approve THEN 'Availability approved' ELSE 'Availability change requested' END, COALESCE(NULLIF(_note,''),'Week of '||r.week_start), '/staff-hub?tab=availability');
  PERFORM staff_log(r.org_id, NULL, r.user_id, CASE WHEN _approve THEN 'availability_approved' ELSE 'availability_changes' END);
END $$;

GRANT EXECUTE ON FUNCTION public.staff_is_admin(uuid), public.staff_is_member(uuid,uuid), public.staff_is_manager(uuid), public.staff_can_view(uuid), public.staff_is_assigned(uuid),
  public.staff_team(uuid), public.staff_set_manager(uuid,uuid,boolean), public.staff_create_task(uuid,jsonb,uuid[]), public.staff_delete_task(uuid),
  public.staff_change_deadline(uuid,timestamptz), public.staff_add_assignees(uuid,uuid[]), public.staff_start_task(uuid), public.staff_submit_task(uuid,text,text[],jsonb),
  public.staff_review_task(uuid,boolean,text), public.staff_request_extension(uuid,timestamptz,text), public.staff_decide_extension(uuid,boolean),
  public.staff_add_comment(uuid,text), public.staff_submit_availability(uuid,date,text,numeric,jsonb,text), public.staff_review_availability(uuid,boolean,text) TO authenticated;

-- files
CREATE POLICY "staff hub files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='staff-hub-files' AND public.staff_can_view(((storage.foldername(name))[1])::uuid));
CREATE POLICY "staff hub files write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='staff-hub-files' AND public.staff_can_view(((storage.foldername(name))[1])::uuid));

ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_tasks, public.staff_task_assignees, public.staff_task_comments, public.staff_task_submissions;
