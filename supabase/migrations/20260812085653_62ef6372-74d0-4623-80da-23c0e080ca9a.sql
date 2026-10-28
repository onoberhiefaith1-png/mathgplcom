ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS child_user_id uuid,
  ADD COLUMN IF NOT EXISTS child_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS counterpart_accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS connections_child_status_idx
  ON public.connections (child_user_id, status);

-- A parent asks a school or teacher to connect one of their children.
CREATE OR REPLACE FUNCTION public.request_connection_for_child(
  _child_user_id uuid,
  _target_user_id uuid,
  _relation connection_relation,
  _message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_me uuid := auth.uid();
  v_their_role public.app_role;
  v_org uuid;
  v_id uuid;
  v_existing public.connections;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF public.account_role_of(v_me) <> 'parent' THEN RAISE EXCEPTION 'relation_not_valid_for_these_accounts'; END IF;
  IF _target_user_id IS NULL OR _target_user_id IN (v_me, _child_user_id) THEN RAISE EXCEPTION 'invalid_target'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.relation = 'parent_child' AND c.status = 'accepted'
      AND ((c.from_user_id = v_me AND c.to_user_id = _child_user_id)
        OR (c.to_user_id = v_me AND c.from_user_id = _child_user_id))
  ) THEN RAISE EXCEPTION 'not_your_child'; END IF;

  IF NOT COALESCE((SELECT p.accepts_requests FROM public.profiles p WHERE p.user_id = _target_user_id), true) THEN
    RAISE EXCEPTION 'account_not_accepting_requests';
  END IF;

  v_their_role := public.account_role_of(_target_user_id);
  IF v_their_role IS NULL THEN RAISE EXCEPTION 'unknown_account'; END IF;

  IF NOT ((_relation = 'parent_school' AND v_their_role = 'school')
       OR (_relation = 'parent_teacher' AND v_their_role = 'teacher')) THEN
    RAISE EXCEPTION 'relation_not_valid_for_these_accounts';
  END IF;

  IF _relation = 'parent_school' THEN
    SELECT o.id INTO v_org FROM public.organizations o
    WHERE o.owner_user_id = _target_user_id AND o.kind = 'school'
    ORDER BY o.created_at LIMIT 1;
    IF v_org IS NULL THEN RAISE EXCEPTION 'school_workspace_not_found'; END IF;
  END IF;

  SELECT * INTO v_existing FROM public.connections c
  WHERE c.relation = _relation
    AND c.status IN ('pending', 'accepted')
    AND c.child_user_id = _child_user_id
    AND ((c.from_user_id = v_me AND c.to_user_id = _target_user_id)
      OR (c.from_user_id = _target_user_id AND c.to_user_id = v_me))
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN RETURN v_existing.id; END IF;

  INSERT INTO public.connections (relation, from_user_id, to_user_id, org_id, message, child_user_id)
  VALUES (_relation, v_me, _target_user_id, v_org, NULLIF(_message, ''), _child_user_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.request_connection_for_child(uuid, uuid, connection_relation, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_connection_for_child(uuid, uuid, connection_relation, text) TO authenticated;

-- Answering a request. A request raised for a child needs two yeses: the
-- school or teacher, and the child.
CREATE OR REPLACE FUNCTION public.respond_to_connection(_connection_id uuid, _accept boolean)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.connections;
  v_member uuid;
  v_member_role public.app_role;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.connections
  WHERE id = _connection_id
    AND status = 'pending'
    AND (to_user_id = v_me OR child_user_id = v_me)
  FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;

  IF NOT _accept THEN
    UPDATE public.connections SET status = 'rejected', responded_at = now() WHERE id = _connection_id;
    RETURN 'rejected';
  END IF;

  IF v_row.child_user_id IS NOT NULL THEN
    IF v_me = v_row.child_user_id THEN
      UPDATE public.connections SET child_confirmed_at = now() WHERE id = _connection_id
      RETURNING * INTO v_row;
    ELSE
      UPDATE public.connections SET counterpart_accepted_at = now() WHERE id = _connection_id
      RETURNING * INTO v_row;
    END IF;

    IF v_row.counterpart_accepted_at IS NULL THEN RETURN 'awaiting_recipient'; END IF;
    IF v_row.child_confirmed_at IS NULL THEN RETURN 'awaiting_student'; END IF;
  ELSIF v_row.to_user_id <> v_me THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  UPDATE public.connections SET status = 'accepted', responded_at = now() WHERE id = _connection_id;

  IF v_row.relation IN ('school_teacher', 'school_student') AND v_row.org_id IS NOT NULL THEN
    v_member := CASE
      WHEN public.account_role_of(v_row.from_user_id) = 'school' THEN v_row.to_user_id
      ELSE v_row.from_user_id END;
    v_member_role := CASE WHEN v_row.relation = 'school_teacher' THEN 'teacher' ELSE 'student' END;

    INSERT INTO public.account_memberships (user_id, org_id, role, status)
    VALUES (v_member, v_row.org_id, v_member_role, 'active')
    ON CONFLICT (user_id, org_id) DO UPDATE SET status = 'active';
  END IF;

  RETURN 'accepted';
END $$;

REVOKE EXECUTE ON FUNCTION public.respond_to_connection(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_to_connection(uuid, boolean) TO authenticated;

-- Connection lists now carry the child a request was raised for, and a child
-- sees requests raised on their behalf.
DROP FUNCTION IF EXISTS public.my_connections(text);
CREATE FUNCTION public.my_connections(_status text DEFAULT 'accepted'::text)
RETURNS TABLE(
  id uuid, relation connection_relation, status text, direction text,
  counterpart_user_id uuid, counterpart_name text, counterpart_username text,
  counterpart_role app_role, org_id uuid, org_name text, message text,
  created_at timestamptz,
  child_user_id uuid, child_name text,
  child_confirmed_at timestamptz, counterpart_accepted_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.id, c.relation, c.status,
         CASE WHEN c.from_user_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
         other.user_id,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         COALESCE(p.username, 'mathgpl'), a.role,
         c.org_id, o.name,
         c.message, c.created_at,
         c.child_user_id,
         COALESCE(NULLIF(cp.display_name, ''), NULL),
         c.child_confirmed_at, c.counterpart_accepted_at
  FROM public.connections c
  CROSS JOIN LATERAL (
    SELECT CASE WHEN c.from_user_id = auth.uid() THEN c.to_user_id ELSE c.from_user_id END AS user_id
  ) other
  LEFT JOIN public.profiles p ON p.user_id = other.user_id
  LEFT JOIN public.account_ids a ON a.user_id = other.user_id
  LEFT JOIN public.organizations o ON o.id = c.org_id
  LEFT JOIN public.profiles cp ON cp.user_id = c.child_user_id
  WHERE auth.uid() IS NOT NULL
    AND (c.from_user_id = auth.uid() OR c.to_user_id = auth.uid() OR c.child_user_id = auth.uid())
    AND (_status IS NULL OR _status = 'all' OR c.status = _status)
  ORDER BY c.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.my_connections(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_connections(text) TO authenticated;

-- One row per child: how many schools and teachers, and overall progress.
CREATE OR REPLACE FUNCTION public.parent_child_overview()
RETURNS TABLE(
  child_user_id uuid, display_name text, username text,
  schools int, teachers int, classes int, progress int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH kids AS (
    SELECT CASE WHEN c.from_user_id = auth.uid() THEN c.to_user_id ELSE c.from_user_id END AS kid
    FROM public.connections c
    WHERE auth.uid() IS NOT NULL
      AND c.relation = 'parent_child' AND c.status = 'accepted'
      AND (c.from_user_id = auth.uid() OR c.to_user_id = auth.uid())
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
           WHERE sp.student_id = k.kid), 0)
  FROM kids k
  LEFT JOIN public.profiles p ON p.user_id = k.kid
  ORDER BY 2
$$;

REVOKE EXECUTE ON FUNCTION public.parent_child_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.parent_child_overview() TO authenticated;

-- The same child, split by school and by teacher.
CREATE OR REPLACE FUNCTION public.parent_child_breakdown(_child_user_id uuid)
RETURNS TABLE(kind text, name text, classes int, progress int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.relation = 'parent_child' AND c.status = 'accepted'
      AND ((c.from_user_id = auth.uid() AND c.to_user_id = _child_user_id)
        OR (c.to_user_id = auth.uid() AND c.from_user_id = _child_user_id))
  ) THEN RAISE EXCEPTION 'not_your_child'; END IF;

  RETURN QUERY
  SELECT 'school'::text,
         COALESCE(NULLIF(o.name, ''), 'School'),
         count(DISTINCT cl.id)::int,
         COALESCE(round(avg(sp.progress))::int, 0)
  FROM public.class_members m
  JOIN public.classes cl ON cl.id = m.class_id
  JOIN public.organizations o ON o.id = cl.org_id
  LEFT JOIN public.student_course_progress sp
    ON sp.student_id = _child_user_id AND sp.class_id = cl.id
  WHERE m.user_id = _child_user_id
  GROUP BY o.id, o.name;

  RETURN QUERY
  SELECT 'teacher'::text,
         COALESCE(NULLIF(tp.display_name, ''), 'Teacher'),
         count(DISTINCT cl.id)::int,
         COALESCE(round(avg(sp.progress))::int, 0)
  FROM public.class_members m
  JOIN public.classes cl ON cl.id = m.class_id
  LEFT JOIN public.profiles tp ON tp.user_id = cl.owner_id
  LEFT JOIN public.student_course_progress sp
    ON sp.student_id = _child_user_id AND sp.class_id = cl.id
  WHERE m.user_id = _child_user_id
  GROUP BY cl.owner_id, tp.display_name;
END $$;

REVOKE EXECUTE ON FUNCTION public.parent_child_breakdown(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.parent_child_breakdown(uuid) TO authenticated;