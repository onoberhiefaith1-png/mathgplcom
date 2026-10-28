CREATE OR REPLACE FUNCTION public.ensure_account(_requested_role text DEFAULT 'teacher', _org_name text DEFAULT NULL)
RETURNS TABLE(role public.app_role, org_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_org uuid;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT public.current_role_name() INTO v_role;

  IF v_role IS NULL THEN
    IF _requested_role IN ('school','teacher','parent','student') THEN
      v_role := _requested_role::public.app_role;
    ELSE
      v_role := 'teacher';
    END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  SELECT m.org_id INTO v_org FROM public.account_memberships m
  WHERE m.user_id = v_uid AND m.status = 'active'
  ORDER BY m.created_at LIMIT 1;

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
END $$;

REVOKE EXECUTE ON FUNCTION public.ensure_account(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_account(text, text) TO authenticated;