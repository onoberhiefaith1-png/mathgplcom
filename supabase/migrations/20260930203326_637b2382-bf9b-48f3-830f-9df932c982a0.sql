CREATE OR REPLACE FUNCTION public.staff_mark_overdue(_org uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0; r record;
BEGIN
  IF NOT (public.staff_is_manager(_org) OR public.staff_is_member(_org)) THEN RETURN 0; END IF;
  FOR r IN
    UPDATE public.staff_task_assignees a SET status = 'overdue', updated_at = now()
      FROM public.staff_tasks t
     WHERE a.task_id = t.id AND a.org_id = _org AND coalesce(t.is_template,false) = false
       AND coalesce(a.deadline, t.deadline) IS NOT NULL AND coalesce(a.deadline, t.deadline) < now()
       AND a.status IN ('assigned','in_progress','changes_requested')
    RETURNING a.task_id, a.user_id
  LOOP
    n := n + 1;
    INSERT INTO public.staff_work_events(org_id, task_id, subject_user_id, actor_id, kind, detail)
    VALUES (_org, r.task_id, r.user_id, NULL, 'overdue', '{}'::jsonb);
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.staff_mark_overdue(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_mark_overdue(uuid) TO authenticated;

-- Facts about the MathGPL item a task links to (read-only evidence).
CREATE OR REPLACE FUNCTION public.staff_task_evidence(_task uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; out jsonb := '[]'::jsonb; since timestamptz;
BEGIN
  SELECT * INTO t FROM public.staff_tasks WHERE id = _task;
  IF t IS NULL OR NOT (public.staff_is_manager(t.org_id) OR public.staff_is_assigned(_task)) THEN RETURN out; END IF;
  since := t.created_at;
  IF t.link_id IS NULL THEN RETURN out; END IF;
  IF t.link_kind = 'lesson_note' THEN
    SELECT jsonb_build_array(
      jsonb_build_object('label','Lesson note last edited','at', n.updated_at),
      jsonb_build_object('label','Sections in note','value',(SELECT count(*) FROM notebook_sections s WHERE s.notebook_id = n.id)),
      jsonb_build_object('label','Sections added since task set','value',(SELECT count(*) FROM notebook_sections s WHERE s.notebook_id = n.id AND s.created_at >= since)))
      INTO out FROM notebooks n WHERE n.id = t.link_id::uuid;
  ELSIF t.link_kind = 'academia_session' THEN
    SELECT jsonb_build_array(
      jsonb_build_object('label','Questions in Session','value',(SELECT count(*) FROM academia_activities a WHERE a.session_id = t.link_id::uuid)),
      jsonb_build_object('label','Questions added since task set','value',(SELECT count(*) FROM academia_activities a WHERE a.session_id = t.link_id::uuid AND a.created_at >= since)),
      jsonb_build_object('label','Student attempts','value',(SELECT count(*) FROM academia_attempts x WHERE x.session_id = t.link_id::uuid)))
      INTO out;
  ELSIF t.link_kind = 'game' THEN
    SELECT jsonb_build_array(
      jsonb_build_object('label','Game last updated','at', g.updated_at),
      jsonb_build_object('label','Classes playing','value',(SELECT count(*) FROM slate_game_assignments s WHERE s.game_id = g.id)))
      INTO out FROM slate_games g WHERE g.id = t.link_id::uuid;
  ELSIF t.link_kind = 'assessment' THEN
    SELECT jsonb_build_array(
      jsonb_build_object('label','Assignment created','at', a.created_at),
      jsonb_build_object('label','Students working','value',(SELECT count(*) FROM assessment_progress p WHERE p.assessment_id = a.id)))
      INTO out FROM assessments a WHERE a.id = t.link_id::uuid;
  END IF;
  RETURN coalesce(out, '[]'::jsonb);
EXCEPTION WHEN others THEN RETURN '[]'::jsonb;
END $$;
REVOKE EXECUTE ON FUNCTION public.staff_task_evidence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_task_evidence(uuid) TO authenticated;