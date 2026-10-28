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

  -- A school is not another school's workspace, a teacher is not another
  -- teacher's student, and students do not connect to each other.
  IF v_my_role = v_their_role THEN RAISE EXCEPTION 'relation_not_valid_for_these_accounts'; END IF;

  v_roles := CASE _relation
    WHEN 'school_teacher'   THEN ARRAY['school','teacher']::public.app_role[]
    WHEN 'school_student'   THEN ARRAY['school','student']::public.app_role[]
    WHEN 'teacher_student'  THEN ARRAY['teacher','student']::public.app_role[]
    WHEN 'parent_child'     THEN ARRAY['parent','student']::public.app_role[]
    WHEN 'parent_teacher'   THEN ARRAY['parent','teacher']::public.app_role[]
    WHEN 'parent_school'    THEN ARRAY['parent','school']::public.app_role[]
    ELSE NULL
  END;

  IF v_roles IS NULL THEN RAISE EXCEPTION 'relation_not_valid_for_these_accounts'; END IF;

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