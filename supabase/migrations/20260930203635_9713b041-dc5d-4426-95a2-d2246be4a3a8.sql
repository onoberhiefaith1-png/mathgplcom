CREATE OR REPLACE FUNCTION public.staff_mark_overdue(_org uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0; r record;
BEGIN
  IF NOT (public.staff_is_manager(_org) OR public.staff_is_member(_org)) THEN RETURN 0; END IF;
  FOR r IN
    SELECT a.task_id, a.user_id, t.title FROM public.staff_task_assignees a
      JOIN public.staff_tasks t ON t.id = a.task_id
     WHERE a.org_id = _org AND coalesce(t.is_template,false) = false
       AND a.deadline IS NOT NULL AND a.deadline < now()
       AND a.status IN ('assigned','in_progress','changes_requested')
       AND NOT EXISTS (SELECT 1 FROM public.staff_work_events e
                        WHERE e.task_id = a.task_id AND e.subject_user_id = a.user_id AND e.kind = 'overdue'
                          AND e.created_at > a.deadline)
  LOOP
    n := n + 1;
    INSERT INTO public.staff_work_events(org_id, task_id, subject_user_id, actor_id, kind, detail)
    VALUES (_org, r.task_id, r.user_id, NULL, 'overdue', jsonb_build_object('title', r.title));
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.staff_mark_overdue(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_mark_overdue(uuid) TO authenticated;