-- 1. No automatic 'teacher' when repairing an existing account.
CREATE OR REPLACE FUNCTION public.ensure_account(_requested_role text DEFAULT NULL::text, _org_name text DEFAULT NULL::text)
 RETURNS TABLE(role app_role, org_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  -- The stored account role is authoritative and is never overwritten here.
  SELECT public.current_role_name() INTO v_role;

  IF v_role IS NULL THEN
    -- Only the type chosen at registration counts. There is no fallback:
    -- an account is never silently turned into a teacher.
    v_role := COALESCE(
      CASE WHEN _requested_role IN ('school','teacher','parent','student')
           THEN _requested_role::public.app_role ELSE NULL END,
      public.signup_role_of(v_uid));

    IF v_role IS NULL THEN
      RETURN QUERY SELECT NULL::public.app_role, NULL::uuid;
      RETURN;
    END IF;

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

-- 2. New accounts: no automatic 'teacher' either.
CREATE OR REPLACE FUNCTION public.handle_new_user_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_org uuid;
  v_name text;
BEGIN
  v_role := CASE
    WHEN NULLIF(NEW.raw_user_meta_data->>'account_role','') IN ('school','teacher','parent','student')
      THEN (NEW.raw_user_meta_data->>'account_role')::public.app_role
    ELSE NULL
  END;

  -- Registration must state the account type. Without it the account is left
  -- roleless rather than becoming a teacher by accident.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role IN ('school','teacher','parent') THEN
    v_name := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'organization_name',''),
      NULLIF(NEW.raw_user_meta_data->>'display_name',''),
      split_part(NEW.email,'@',1)
    );
    INSERT INTO public.organizations (kind, name, owner_user_id)
    VALUES (v_role::text, v_name || ' workspace', NEW.id)
    RETURNING id INTO v_org;

    INSERT INTO public.account_memberships (user_id, org_id, role)
    VALUES (NEW.id, v_org, v_role) ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.issue_account_id(NEW.id, v_role);

  RETURN NEW;
END $function$;

-- 3. Administrator roles can only be changed by deliberate admin tooling
--    (service-role context), never by an ordinary signed-in request.
CREATE OR REPLACE FUNCTION public.guard_admin_role_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role := COALESCE(NEW.role, OLD.role);
BEGIN
  IF v_role IN ('platform_owner','co_admin') AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'admin_role_change_not_permitted';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $function$;

DROP TRIGGER IF EXISTS guard_admin_role_changes ON public.user_roles;
CREATE TRIGGER guard_admin_role_changes
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role_changes();

-- 4. Remove the stray teacher role from the platform administrator account.
DELETE FROM public.user_roles
WHERE user_id = '646e35a6-2172-4647-96a1-cb20c0a4765b'
  AND role = 'teacher'
  AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = '646e35a6-2172-4647-96a1-cb20c0a4765b'
      AND r.role = 'platform_owner'
  );