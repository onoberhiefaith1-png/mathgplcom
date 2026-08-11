CREATE OR REPLACE FUNCTION public.school_teachers(_org_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, mathgpl_id text, status text, connection_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH people AS (
    SELECT m.user_id, m.status
    FROM public.account_memberships m
    WHERE m.org_id = _org_id AND m.role = 'teacher' AND m.status <> 'removed'
    UNION
    SELECT CASE WHEN public.account_role_of(c.from_user_id) = 'school'
                THEN c.to_user_id ELSE c.from_user_id END, 'active'
    FROM public.connections c
    WHERE c.org_id = _org_id AND c.relation = 'school_teacher' AND c.status = 'accepted'
  )
  SELECT p2.user_id,
         COALESCE(NULLIF(trim(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')), ''),
                  NULLIF(pr.display_name, ''),
                  'Teacher'),
         COALESCE(pr.username, 'mathgpl'),
         pr.avatar_url,
         a.mathgpl_id,
         min(p2.status),
         COALESCE((SELECT c.status FROM public.connections c
                    WHERE c.org_id = _org_id AND c.relation = 'school_teacher'
                      AND (c.from_user_id = p2.user_id OR c.to_user_id = p2.user_id)
                    ORDER BY c.created_at DESC LIMIT 1), 'connected')
  FROM people p2
  LEFT JOIN public.profiles pr ON pr.user_id = p2.user_id
  LEFT JOIN public.account_ids a ON a.user_id = p2.user_id
  WHERE public.is_org_owner(_org_id)
  GROUP BY p2.user_id, pr.display_name, pr.first_name, pr.last_name, pr.username, pr.avatar_url, a.mathgpl_id
  ORDER BY 2;
$function$;

DROP FUNCTION IF EXISTS public.school_member_overview(uuid, uuid);

CREATE OR REPLACE FUNCTION public.school_member_overview(_org_id uuid, _user_id uuid)
 RETURNS TABLE(display_name text, first_name text, last_name text, username text, avatar_url text, mathgpl_id text, role app_role, status text, classes integer, students integer, lesson_notes integer, assignments integer, adventures integer, avg_progress numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(NULLIF(trim(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''),
                  NULLIF(p.display_name, ''),
                  'Member'),
         p.first_name,
         p.last_name,
         p.username,
         p.avatar_url,
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
    SELECT count(*)::int AS notes FROM public.notebooks nb
    WHERE nb.owner_id = m.user_id AND nb.org_id = _org_id
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
    SELECT count(*)::int AS adventures
    FROM public.adventure_games ag
    WHERE ag.owner_id = m.user_id
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
$function$;