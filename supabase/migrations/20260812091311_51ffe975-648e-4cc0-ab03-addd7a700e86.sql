-- Parent Console figures. All security definer, all scoped to the caller's own children.

DROP FUNCTION IF EXISTS public.parent_child_overview();

CREATE OR REPLACE FUNCTION public.parent_child_overview()
RETURNS TABLE(
  child_user_id uuid,
  display_name text,
  username text,
  schools integer,
  teachers integer,
  classes integer,
  progress integer,
  assignments integer,
  adventures integer,
  skill_builder integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH kids AS (
    SELECT CASE WHEN c.from_user_id = auth.uid() THEN c.to_user_id ELSE c.from_user_id END AS kid
    FROM public.connections c
    WHERE auth.uid() IS NOT NULL
      AND c.relation = 'parent_child' AND c.status = 'accepted'
      AND (c.from_user_id = auth.uid() OR c.to_user_id = auth.uid())
  ),
  member_classes AS (
    SELECT k.kid, m.class_id
    FROM kids k
    JOIN public.class_members m ON m.user_id = k.kid
  ),
  assigned AS (
    SELECT mc.kid,
           a.id AS assessment_id,
           COALESCE(a.kind, 'assessment') AS kind,
           CASE WHEN ap.status IN ('completed', 'submitted') THEN 1 ELSE 0 END AS done
    FROM member_classes mc
    JOIN public.assessments a ON a.class_id = mc.class_id AND a.unassigned_at IS NULL
    LEFT JOIN public.assessment_progress ap
      ON ap.assessment_id = a.id AND ap.student_id = mc.kid
  )
  SELECT k.kid,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         COALESCE(p.username, 'mathgpl'),
         (SELECT count(DISTINCT c.id)::int FROM public.connections c
           WHERE c.status = 'accepted' AND c.relation = 'school_student'
             AND (c.from_user_id = k.kid OR c.to_user_id = k.kid)),
         (SELECT count(DISTINCT c.id)::int FROM public.connections c
           WHERE c.status = 'accepted' AND c.relation = 'teacher_student'
             AND (c.from_user_id = k.kid OR c.to_user_id = k.kid)),
         (SELECT count(*)::int FROM public.class_members m WHERE m.user_id = k.kid),
         COALESCE((SELECT round(avg(sp.progress))::int FROM public.student_course_progress sp
           WHERE sp.student_id = k.kid), 0),
         COALESCE((SELECT round(100.0 * avg(a.done))::int FROM assigned a
           WHERE a.kid = k.kid AND a.kind <> 'adventure'), 0),
         COALESCE((SELECT round(100.0 * avg(a.done))::int FROM assigned a
           WHERE a.kid = k.kid AND a.kind = 'adventure'), 0),
         COALESCE((SELECT round(avg(sp.progress))::int FROM public.student_course_progress sp
           WHERE sp.student_id = k.kid), 0)
  FROM kids k
  LEFT JOIN public.profiles p ON p.user_id = k.kid
  ORDER BY 2
$function$;

GRANT EXECUTE ON FUNCTION public.parent_child_overview() TO authenticated;

-- Every school and teacher the parent's children are connected to.
CREATE OR REPLACE FUNCTION public.parent_family_connections()
RETURNS TABLE(
  kind text,
  target_user_id uuid,
  name text,
  username text,
  children integer,
  connected_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH kids AS (
    SELECT CASE WHEN c.from_user_id = auth.uid() THEN c.to_user_id ELSE c.from_user_id END AS kid
    FROM public.connections c
    WHERE auth.uid() IS NOT NULL
      AND c.relation = 'parent_child' AND c.status = 'accepted'
      AND (c.from_user_id = auth.uid() OR c.to_user_id = auth.uid())
  ),
  links AS (
    SELECT CASE WHEN c.relation = 'school_student' THEN 'school' ELSE 'teacher' END AS kind,
           CASE WHEN c.from_user_id = k.kid THEN c.to_user_id ELSE c.from_user_id END AS target,
           k.kid,
           c.created_at
    FROM kids k
    JOIN public.connections c
      ON c.status = 'accepted'
     AND c.relation IN ('school_student', 'teacher_student')
     AND (c.from_user_id = k.kid OR c.to_user_id = k.kid)
  )
  SELECT l.kind,
         l.target,
         COALESCE(NULLIF(p.display_name, ''), CASE WHEN l.kind = 'school' THEN 'School' ELSE 'Teacher' END),
         p.username,
         count(DISTINCT l.kid)::int,
         min(l.created_at)
  FROM links l
  LEFT JOIN public.profiles p ON p.user_id = l.target
  GROUP BY l.kind, l.target, p.display_name, p.username
  ORDER BY 1, 3
$function$;

GRANT EXECUTE ON FUNCTION public.parent_family_connections() TO authenticated;

-- The ten most recent completions across the parent's children.
CREATE OR REPLACE FUNCTION public.parent_family_activity()
RETURNS TABLE(
  child_user_id uuid,
  child_name text,
  kind text,
  title text,
  happened_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH kids AS (
    SELECT CASE WHEN c.from_user_id = auth.uid() THEN c.to_user_id ELSE c.from_user_id END AS kid
    FROM public.connections c
    WHERE auth.uid() IS NOT NULL
      AND c.relation = 'parent_child' AND c.status = 'accepted'
      AND (c.from_user_id = auth.uid() OR c.to_user_id = auth.uid())
  ),
  events AS (
    SELECT k.kid,
           CASE WHEN COALESCE(a.kind, 'assessment') = 'adventure' THEN 'adventure' ELSE 'assignment' END AS kind,
           COALESCE(NULLIF(a.title, ''), 'Assignment') AS title,
           ap.updated_at AS at
    FROM kids k
    JOIN public.assessment_progress ap ON ap.student_id = k.kid AND ap.status IN ('completed', 'submitted')
    JOIN public.assessments a ON a.id = ap.assessment_id
    UNION ALL
    SELECT k.kid,
           'skill'::text,
           COALESCE(NULLIF(co.title, ''), 'Skill pathway'),
           sp.updated_at
    FROM kids k
    JOIN public.student_course_progress sp ON sp.student_id = k.kid AND sp.status = 'completed'
    LEFT JOIN public.courses co ON co.id = sp.course_id
  )
  SELECT e.kid,
         COALESCE(NULLIF(p.display_name, ''), 'Child'),
         e.kind,
         e.title,
         e.at
  FROM events e
  LEFT JOIN public.profiles p ON p.user_id = e.kid
  ORDER BY e.at DESC NULLS LAST
  LIMIT 10
$function$;

GRANT EXECUTE ON FUNCTION public.parent_family_activity() TO authenticated;