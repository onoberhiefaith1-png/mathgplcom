-- 1. Name fallback also understands Google metadata (full_name / name)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.profiles (
    user_id, display_name, mathgpl_student_id,
    first_name, last_name, country, time_zone, date_of_birth,
    subjects_taught, school_name, children_count,
    marketing_opt_in, terms_accepted_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(m->>'display_name',''),
      NULLIF(trim(COALESCE(m->>'first_name','') || ' ' || COALESCE(m->>'last_name','')), ''),
      NULLIF(m->>'full_name',''),
      NULLIF(m->>'name',''),
      split_part(NEW.email, '@', 1)
    ),
    public.generate_mathgpl_id(),
    NULLIF(m->>'first_name',''),
    NULLIF(m->>'last_name',''),
    NULLIF(m->>'country',''),
    NULLIF(m->>'time_zone',''),
    NULLIF(m->>'date_of_birth','')::date,
    NULLIF(m->>'subjects_taught',''),
    NULLIF(m->>'school_name',''),
    NULLIF(m->>'children_count','')::int,
    COALESCE((m->>'marketing_opt_in')::boolean, false),
    CASE WHEN COALESCE((m->>'terms_accepted')::boolean, false) THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $function$;

-- 2. Backfill the accounts that have no profile record at all
INSERT INTO public.profiles (
  user_id, display_name, mathgpl_student_id, first_name, last_name, date_of_birth
)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'display_name',''),
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'first_name','') || ' ' || COALESCE(u.raw_user_meta_data->>'last_name','')), ''),
    NULLIF(u.raw_user_meta_data->>'full_name',''),
    NULLIF(u.raw_user_meta_data->>'name',''),
    split_part(u.email, '@', 1)
  ),
  public.generate_mathgpl_id(),
  NULLIF(u.raw_user_meta_data->>'first_name',''),
  NULLIF(u.raw_user_meta_data->>'last_name',''),
  NULLIF(u.raw_user_meta_data->>'date_of_birth','')::date
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- 3. Issue permanent account IDs / share codes where they are missing
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT u.id,
           COALESCE(NULLIF(u.raw_user_meta_data->>'account_role',''), 'teacher') AS role
    FROM auth.users u
    LEFT JOIN public.account_ids a ON a.user_id = u.id
    WHERE a.user_id IS NULL
  LOOP
    BEGIN
      PERFORM public.issue_account_id(
        r.id,
        CASE WHEN r.role IN ('school','teacher','parent','student','co_admin','platform_owner')
             THEN r.role::public.app_role ELSE 'teacher'::public.app_role END);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END $do$;

-- 4. First sign-in self-heals a missing profile
CREATE OR REPLACE FUNCTION public.ensure_account(_requested_role text DEFAULT 'teacher'::text, _org_name text DEFAULT NULL::text)
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

  -- Every account must own a profile: Go Live, the username and the public
  -- identity all live there.
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
    IF _requested_role IN ('school','teacher','parent','student') THEN
      v_role := _requested_role::public.app_role;
    ELSE
      v_role := 'teacher';
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

  SELECT m2.org_id INTO v_org FROM public.account_memberships m2
  WHERE m2.user_id = v_uid AND m2.status = 'active'
  ORDER BY m2.created_at LIMIT 1;

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

-- 5. Go Live must never report a false success
CREATE OR REPLACE FUNCTION public.set_go_live(_live boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_rows int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles SET is_live = _live WHERE user_id = auth.uid();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'profile_missing'; END IF;
  RETURN _live;
END $function$;

CREATE OR REPLACE FUNCTION public.set_accepts_requests(_accept boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_rows int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles SET accepts_requests = _accept WHERE user_id = auth.uid();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'profile_missing'; END IF;
  RETURN _accept;
END $function$;