-- Teachers connected to a school. Owner only.
CREATE OR REPLACE FUNCTION public.school_teachers(_org_id uuid)
RETURNS TABLE(user_id uuid, display_name text, mathgpl_id text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id,
         COALESCE(p.display_name, 'Teacher'),
         a.mathgpl_id,
         m.status
  FROM public.account_memberships m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  LEFT JOIN public.account_ids a ON a.user_id = m.user_id AND a.role = 'teacher'
  WHERE m.org_id = _org_id
    AND m.role = 'teacher'
    AND public.is_org_owner(_org_id)
  ORDER BY 2;
$$;

-- One member's school work, as numbers only. Owner only, member only.
CREATE OR REPLACE FUNCTION public.school_member_overview(_org_id uuid, _user_id uuid)
RETURNS TABLE(
  display_name text,
  mathgpl_id text,
  role app_role,
  status text,
  classes integer,
  students integer,
  lesson_notes integer,
  assignments integer,
  adventures integer,
  avg_progress numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.display_name, 'Member'),
         a.mathgpl_id,
         m.role,
         m.status,
         COALESCE(c.classes, 0)::int,
         COALESCE(c.students, 0)::int,
         COALESCE(n.notes, 0)::int,
         COALESCE(asg.assignments, 0)::int,
         COALESCE(adv.adventures, 0)::int,
         COALESCE(pr.avg_progress, 0)::numeric
  FROM public.account_memberships m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  LEFT JOIN public.account_ids a ON a.user_id = m.user_id AND a.role = m.role
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS classes,
           count(DISTINCT cm.user_id)::int AS students
    FROM public.classes cl
    LEFT JOIN public.class_members cm ON cm.class_id = cl.id
    WHERE cl.org_id = _org_id
      AND (CASE WHEN m.role = 'teacher' THEN cl.owner_id = m.user_id ELSE cl.id IN (
             SELECT class_id FROM public.class_members WHERE user_id = m.user_id) END)
  ) c ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS notes FROM public.notebooks nb WHERE nb.owner_id = m.user_id
  ) n ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS assignments
    FROM public.learning_assignments la
    JOIN public.classes cl2 ON cl2.id = la.class_id
    WHERE cl2.org_id = _org_id
      AND (CASE WHEN m.role = 'teacher' THEN cl2.owner_id = m.user_id ELSE cl2.id IN (
             SELECT class_id FROM public.class_members WHERE user_id = m.user_id) END)
  ) asg ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS adventures FROM public.adventure_games ag WHERE ag.owner_id = m.user_id
  ) adv ON TRUE
  LEFT JOIN LATERAL (
    SELECT avg(scp.progress)::numeric AS avg_progress
    FROM public.student_course_progress scp
    JOIN public.classes cl3 ON cl3.id = scp.class_id
    WHERE cl3.org_id = _org_id
      AND (CASE WHEN m.role = 'teacher' THEN cl3.owner_id = m.user_id ELSE scp.student_id = m.user_id END)
  ) pr ON TRUE
  WHERE m.org_id = _org_id
    AND m.user_id = _user_id
    AND public.is_org_owner(_org_id)
  LIMIT 1;
$$;

-- One member's classes inside this school, for the drill-down. Owner only.
CREATE OR REPLACE FUNCTION public.school_member_classes(_org_id uuid, _user_id uuid)
RETURNS TABLE(id uuid, name text, students integer, assignments integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cl.id,
         cl.name,
         (SELECT count(*)::int FROM public.class_members cm WHERE cm.class_id = cl.id),
         (SELECT count(*)::int FROM public.learning_assignments la WHERE la.class_id = cl.id)
  FROM public.classes cl
  WHERE cl.org_id = _org_id
    AND public.is_org_owner(_org_id)
    AND (
      cl.owner_id = _user_id
      OR cl.id IN (SELECT class_id FROM public.class_members WHERE user_id = _user_id)
    )
  ORDER BY cl.name;
$$;

GRANT EXECUTE ON FUNCTION public.school_teachers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_member_overview(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_member_classes(uuid, uuid) TO authenticated;