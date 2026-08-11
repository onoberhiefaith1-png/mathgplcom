-- Discovery: public username, no private ID
DROP FUNCTION IF EXISTS public.discover_accounts(app_role, text);
CREATE FUNCTION public.discover_accounts(_role app_role, _q text DEFAULT ''::text)
RETURNS TABLE(user_id uuid, display_name text, username text, role app_role, activity integer, connection_status text, accepts_requests boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT p.user_id,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         COALESCE(p.username, 'mathgpl'),
         a.role,
         public.account_activity_score(p.user_id),
         (SELECT c.status FROM public.connections c
           WHERE c.status IN ('pending', 'accepted')
             AND ((c.from_user_id = auth.uid() AND c.to_user_id = p.user_id)
               OR (c.to_user_id = auth.uid() AND c.from_user_id = p.user_id))
           ORDER BY c.created_at DESC LIMIT 1),
         COALESCE(p.accepts_requests, true)
  FROM public.profiles p
  JOIN public.account_ids a ON a.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL
    AND _role IN ('teacher', 'student', 'parent')
    AND a.role = _role
    AND p.is_live = true
    AND p.user_id <> auth.uid()
    AND (COALESCE(_q, '') = ''
         OR p.display_name ILIKE '%' || _q || '%'
         OR p.username ILIKE '%' || _q || '%')
  ORDER BY public.account_activity_score(p.user_id) DESC, p.display_name
  LIMIT 60
$function$;
GRANT EXECUTE ON FUNCTION public.discover_accounts(app_role, text) TO authenticated;

DROP FUNCTION IF EXISTS public.discover_schools(text);
CREATE FUNCTION public.discover_schools(_q text DEFAULT ''::text)
RETURNS TABLE(org_id uuid, owner_user_id uuid, name text, username text, teachers integer, students integer, activity integer, connection_status text, accepts_requests boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT o.id, o.owner_user_id, o.name, COALESCE(op.username, 'mathgpl'),
         (SELECT count(*) FROM public.account_memberships m
           WHERE m.org_id = o.id AND m.role = 'teacher' AND m.status = 'active')::int,
         (SELECT count(*) FROM public.account_memberships m
           WHERE m.org_id = o.id AND m.role = 'student' AND m.status = 'active')::int,
         public.account_activity_score(o.owner_user_id),
         (SELECT c.status FROM public.connections c
           WHERE c.status IN ('pending', 'accepted')
             AND ((c.from_user_id = auth.uid() AND c.to_user_id = o.owner_user_id)
               OR (c.to_user_id = auth.uid() AND c.from_user_id = o.owner_user_id))
           ORDER BY c.created_at DESC LIMIT 1),
         COALESCE(op.accepts_requests, true)
  FROM public.organizations o
  LEFT JOIN public.profiles op ON op.user_id = o.owner_user_id
  WHERE auth.uid() IS NOT NULL
    AND o.kind = 'school'
    AND o.visibility = 'public'
    AND o.owner_user_id IS DISTINCT FROM auth.uid()
    AND (COALESCE(_q, '') = '' OR o.name ILIKE '%' || _q || '%' OR op.username ILIKE '%' || _q || '%')
  ORDER BY public.account_activity_score(o.owner_user_id) DESC, o.name
  LIMIT 60
$function$;
GRANT EXECUTE ON FUNCTION public.discover_schools(text) TO authenticated;

DROP FUNCTION IF EXISTS public.my_connections(text);
CREATE FUNCTION public.my_connections(_status text DEFAULT 'accepted'::text)
RETURNS TABLE(id uuid, relation connection_relation, status text, direction text, counterpart_user_id uuid, counterpart_name text, counterpart_username text, counterpart_role app_role, org_id uuid, org_name text, message text, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT c.id, c.relation, c.status,
         CASE WHEN c.from_user_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
         other.user_id,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         COALESCE(p.username, 'mathgpl'), a.role,
         c.org_id, o.name,
         c.message, c.created_at
  FROM public.connections c
  CROSS JOIN LATERAL (
    SELECT CASE WHEN c.from_user_id = auth.uid() THEN c.to_user_id ELSE c.from_user_id END AS user_id
  ) other
  LEFT JOIN public.profiles p ON p.user_id = other.user_id
  LEFT JOIN public.account_ids a ON a.user_id = other.user_id
  LEFT JOIN public.organizations o ON o.id = c.org_id
  WHERE auth.uid() IS NOT NULL
    AND (c.from_user_id = auth.uid() OR c.to_user_id = auth.uid())
    AND (_status IS NULL OR _status = 'all' OR c.status = _status)
  ORDER BY c.created_at DESC
$function$;
GRANT EXECUTE ON FUNCTION public.my_connections(text) TO authenticated;

-- Code lookup: resolves privately, shows only the public profile
DROP FUNCTION IF EXISTS public.resolve_account_code(text);
CREATE FUNCTION public.resolve_account_code(_code text)
RETURNS TABLE(user_id uuid, username text, role app_role, display_name text, org_id uuid, org_name text, matched text, accepts_requests boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_code := upper(regexp_replace(COALESCE(_code, ''), '\s', '', 'g'));
  IF v_code = '' THEN RETURN; END IF;

  RETURN QUERY
  SELECT o.owner_user_id, COALESCE(op.username, 'mathgpl'), COALESCE(a.role, 'school'::app_role),
         COALESCE(NULLIF(o.name, ''), 'MathGPL school'), o.id, o.name, 'school_code',
         COALESCE(op.accepts_requests, true)
  FROM public.organizations o
  LEFT JOIN public.account_ids a ON a.user_id = o.owner_user_id
  LEFT JOIN public.profiles op ON op.user_id = o.owner_user_id
  WHERE o.kind = 'school'
    AND o.invite_code = v_code
    AND o.owner_user_id IS DISTINCT FROM auth.uid()
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT a.user_id, COALESCE(p.username, 'mathgpl'), a.role,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         so.id, so.name, 'mathgpl_id', COALESCE(p.accepts_requests, true)
  FROM public.account_ids a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  LEFT JOIN public.organizations so
    ON so.owner_user_id = a.user_id AND so.kind = 'school'
  WHERE replace(replace(upper(a.mathgpl_id), '/', ''), '-', '') = replace(replace(v_code, '/', ''), '-', '')
    AND a.user_id <> auth.uid()
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT a.user_id, COALESCE(p.username, 'mathgpl'), a.role,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         so.id, so.name, 'share_code', COALESCE(p.accepts_requests, true)
  FROM public.account_ids a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  LEFT JOIN public.organizations so
    ON so.owner_user_id = a.user_id AND so.kind = 'school'
  WHERE a.share_code = v_code
    AND a.user_id <> auth.uid()
  LIMIT 1;
END $function$;
GRANT EXECUTE ON FUNCTION public.resolve_account_code(text) TO authenticated;

DROP FUNCTION IF EXISTS public.resolve_share_code(text);
CREATE FUNCTION public.resolve_share_code(_code text)
RETURNS TABLE(user_id uuid, username text, role app_role, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT a.user_id, COALESCE(p.username, 'mathgpl'), a.role,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account')
  FROM public.account_ids a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE auth.uid() IS NOT NULL
    AND a.share_code = upper(regexp_replace(COALESCE(_code, ''), '\s', '', 'g'))
    AND a.user_id <> auth.uid()
  LIMIT 1
$function$;
GRANT EXECUTE ON FUNCTION public.resolve_share_code(text) TO authenticated;

-- Same-type connections
CREATE OR REPLACE FUNCTION public.request_connection(_target_user_id uuid, _relation connection_relation, _message text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_my_role public.app_role;
  v_their_role public.app_role;
  v_roles public.app_role[];
  v_org uuid;
  v_school uuid;
  v_id uuid;
  v_existing public.connections;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _target_user_id IS NULL OR _target_user_id = v_me THEN RAISE EXCEPTION 'invalid_target'; END IF;

  IF NOT COALESCE((SELECT p.accepts_requests FROM public.profiles p WHERE p.user_id = _target_user_id), true) THEN
    RAISE EXCEPTION 'account_not_accepting_requests';
  END IF;

  v_my_role := public.account_role_of(v_me);
  v_their_role := public.account_role_of(_target_user_id);
  IF v_my_role IS NULL OR v_their_role IS NULL THEN RAISE EXCEPTION 'unknown_account'; END IF;

  v_roles := CASE _relation
    WHEN 'school_teacher'   THEN ARRAY['school','teacher']::public.app_role[]
    WHEN 'school_student'   THEN ARRAY['school','student']::public.app_role[]
    WHEN 'teacher_student'  THEN ARRAY['teacher','student']::public.app_role[]
    WHEN 'parent_child'     THEN ARRAY['parent','student']::public.app_role[]
    WHEN 'parent_teacher'   THEN ARRAY['parent','teacher']::public.app_role[]
    WHEN 'parent_school'    THEN ARRAY['parent','school']::public.app_role[]
    WHEN 'teacher_teacher'  THEN ARRAY['teacher','teacher']::public.app_role[]
    WHEN 'student_student'  THEN ARRAY['student','student']::public.app_role[]
    WHEN 'school_school'    THEN ARRAY['school','school']::public.app_role[]
  END;

  IF NOT ((v_my_role = v_roles[1] AND v_their_role = v_roles[2])
       OR (v_my_role = v_roles[2] AND v_their_role = v_roles[1])) THEN
    RAISE EXCEPTION 'relation_not_valid_for_these_accounts';
  END IF;

  IF _relation IN ('school_teacher', 'school_student', 'parent_school') THEN
    v_school := CASE WHEN v_my_role = 'school' THEN v_me ELSE _target_user_id END;
    SELECT o.id INTO v_org
    FROM public.organizations o
    WHERE o.owner_user_id = v_school AND o.kind = 'school'
    ORDER BY o.created_at LIMIT 1;
    IF v_org IS NULL THEN RAISE EXCEPTION 'school_workspace_not_found'; END IF;
  END IF;

  SELECT * INTO v_existing FROM public.connections c
  WHERE c.relation = _relation
    AND c.status IN ('pending', 'accepted')
    AND COALESCE(c.org_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(v_org, '00000000-0000-0000-0000-000000000000'::uuid)
    AND ((c.from_user_id = v_me AND c.to_user_id = _target_user_id)
      OR (c.from_user_id = _target_user_id AND c.to_user_id = v_me))
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN RETURN v_existing.id; END IF;

  INSERT INTO public.connections (relation, from_user_id, to_user_id, org_id, message)
  VALUES (_relation, v_me, _target_user_id, v_org, NULLIF(_message, ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END $function$;