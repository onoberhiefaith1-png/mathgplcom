CREATE OR REPLACE FUNCTION public.signup_role_of(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN u.raw_user_meta_data->>'account_role' IN ('school','teacher','parent','student')
             THEN (u.raw_user_meta_data->>'account_role')::public.app_role
           ELSE NULL
         END
  FROM auth.users u
  WHERE u.id = _user_id
$$;

REVOKE ALL ON FUNCTION public.signup_role_of(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.issue_account_id(_user_id uuid, _role app_role DEFAULT NULL::app_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_existing text;
  v_role public.app_role;
  v_prefix text;
  v_seq bigint;
  v_org uuid;
  v_id text;
BEGIN
  SELECT mathgpl_id INTO v_existing FROM public.account_ids WHERE user_id = _user_id;

  -- The account type the person chose at registration decides the ID. Platform
  -- roles always win, and 'teacher' is only a last resort.
  v_role := COALESCE(
    _role,
    (SELECT role FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('platform_owner','co_admin')
      ORDER BY CASE role WHEN 'platform_owner' THEN 0 ELSE 1 END
      LIMIT 1),
    public.signup_role_of(_user_id),
    (SELECT role FROM public.user_roles WHERE user_id = _user_id
      ORDER BY CASE role
        WHEN 'platform_owner' THEN 0 WHEN 'co_admin' THEN 1 WHEN 'school' THEN 2
        WHEN 'teacher' THEN 3 WHEN 'parent' THEN 4 ELSE 5 END
      LIMIT 1),
    (SELECT role FROM public.account_ids WHERE user_id = _user_id LIMIT 1),
    'teacher');

  -- An account can never exist with an ID and no account type.
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_prefix := CASE v_role
    WHEN 'platform_owner' THEN 'ADM'
    WHEN 'co_admin' THEN 'ADM'
    WHEN 'school' THEN 'SC'
    WHEN 'teacher' THEN 'TCH'
    WHEN 'parent' THEN 'PAR'
    ELSE 'STU' END;

  IF v_prefix = 'SC' THEN
    SELECT o.id INTO v_org
    FROM public.organizations o
    WHERE o.owner_user_id = _user_id AND o.kind = 'school'
    ORDER BY o.created_at LIMIT 1;
  END IF;

  v_seq := nextval('public.account_seq_' || lower(v_prefix));
  v_id := v_prefix || '/' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.account_ids (user_id, org_id, role, prefix, acronym, seq, mathgpl_id)
  VALUES (_user_id, v_org, v_role, v_prefix, NULL, v_seq, v_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT mathgpl_id INTO v_existing FROM public.account_ids WHERE user_id = _user_id;
  RETURN v_existing;
END $function$;

CREATE OR REPLACE FUNCTION public.ensure_account(_requested_role text DEFAULT 'teacher'::text, _org_name text DEFAULT NULL::text)
RETURNS TABLE(role app_role, org_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_org uuid;
  v_name text;
  m jsonb;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_uid) THEN
    SELECT COALESCE(u.raw_user_meta_data, '{}'::jsonb), u.email INTO m, v_email
    FROM auth.users u WHERE u.id = v_uid;

    INSERT INTO public.profiles (
      user_id, display_name, mathgpl_student_id, first_name, last_name, date_of_birth
    ) VALUES (
      v_uid,
      COALESCE(
        NULLIF(m->>'display_name',''),
        NULLIF(trim(COALESCE(m->>'first_name','') || ' ' || COALESCE(m->>'last_name','')), ''),
        NULLIF(m->>'full_name',''),
        NULLIF(m->>'name',''),
        split_part(COALESCE(v_email,''), '@', 1)
      ),
      public.generate_mathgpl_id(),
      NULLIF(m->>'first_name',''),
      NULLIF(m->>'last_name',''),
      NULLIF(m->>'date_of_birth','')::date
    ) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT public.current_role_name() INTO v_role;

  IF v_role IS NULL THEN
    -- The type chosen at registration comes first; 'teacher' is a last resort.
    v_role := COALESCE(
      CASE WHEN _requested_role IN ('school','teacher','parent','student')
           THEN _requested_role::public.app_role ELSE NULL END,
      public.signup_role_of(v_uid),
      'teacher');
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.account_ids a WHERE a.user_id = v_uid) THEN
    BEGIN
      PERFORM public.issue_account_id(v_uid, v_role);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  -- A school account has exactly one school container: never a second one.
  IF v_role = 'school' THEN
    SELECT o.id INTO v_org FROM public.organizations o
    WHERE o.owner_user_id = v_uid AND o.kind = 'school'
    ORDER BY o.created_at LIMIT 1;
  END IF;

  IF v_org IS NULL THEN
    SELECT m2.org_id INTO v_org FROM public.account_memberships m2
    WHERE m2.user_id = v_uid AND m2.status = 'active'
    ORDER BY m2.created_at LIMIT 1;
  END IF;

  IF v_org IS NULL AND v_role IN ('school','teacher','parent') THEN
    SELECT COALESCE(NULLIF(_org_name,''), NULLIF(p.display_name,''), 'My') INTO v_name
    FROM public.profiles p WHERE p.user_id = v_uid;
    v_name := COALESCE(v_name, 'My');

    INSERT INTO public.organizations (kind, name, owner_user_id)
    VALUES (v_role::text, v_name || ' workspace', v_uid)
    RETURNING id INTO v_org;

    INSERT INTO public.account_memberships (user_id, org_id, role)
    VALUES (v_uid, v_org, v_role) ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_role, v_org;
END $function$;