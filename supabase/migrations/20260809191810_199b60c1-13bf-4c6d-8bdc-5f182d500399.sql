ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepts_requests boolean NOT NULL DEFAULT true;

-- Requests are refused server-side when the recipient is not accepting them.
CREATE OR REPLACE FUNCTION public.request_connection(_target_user_id uuid, _relation connection_relation, _message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHEN 'school_teacher'  THEN ARRAY['school','teacher']::public.app_role[]
    WHEN 'school_student'  THEN ARRAY['school','student']::public.app_role[]
    WHEN 'teacher_student' THEN ARRAY['teacher','student']::public.app_role[]
    WHEN 'parent_child'    THEN ARRAY['parent','student']::public.app_role[]
    WHEN 'parent_teacher'  THEN ARRAY['parent','teacher']::public.app_role[]
    WHEN 'parent_school'   THEN ARRAY['parent','school']::public.app_role[]
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

-- Discovery: parents included, and each row reports whether requests are open.
DROP FUNCTION IF EXISTS public.discover_accounts(app_role, text);
CREATE FUNCTION public.discover_accounts(_role app_role, _q text DEFAULT ''::text)
 RETURNS TABLE(user_id uuid, display_name text, mathgpl_id text, role app_role, activity integer, connection_status text, accepts_requests boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         a.mathgpl_id, a.role,
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
         OR a.mathgpl_id ILIKE '%' || _q || '%')
  ORDER BY public.account_activity_score(p.user_id) DESC, p.display_name
  LIMIT 60
$function$;

DROP FUNCTION IF EXISTS public.discover_schools(text);
CREATE FUNCTION public.discover_schools(_q text DEFAULT ''::text)
 RETURNS TABLE(org_id uuid, owner_user_id uuid, name text, mathgpl_id text, teachers integer, students integer, activity integer, connection_status text, accepts_requests boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.owner_user_id, o.name, a.mathgpl_id,
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
  LEFT JOIN public.account_ids a ON a.user_id = o.owner_user_id
  LEFT JOIN public.profiles op ON op.user_id = o.owner_user_id
  WHERE auth.uid() IS NOT NULL
    AND o.kind = 'school'
    AND o.visibility = 'public'
    AND o.owner_user_id IS DISTINCT FROM auth.uid()
    AND (COALESCE(_q, '') = '' OR o.name ILIKE '%' || _q || '%' OR a.mathgpl_id ILIKE '%' || _q || '%')
  ORDER BY public.account_activity_score(o.owner_user_id) DESC, o.name
  LIMIT 60
$function$;

-- The account owner switches their own request setting.
CREATE OR REPLACE FUNCTION public.set_accepts_requests(_accept boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles SET accepts_requests = _accept WHERE user_id = auth.uid();
  RETURN _accept;
END $function$;

-- One platform-wide default building background, referenced (never copied).
CREATE TABLE IF NOT EXISTS public.platform_building_default (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  background jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_building_default TO anon;
GRANT SELECT ON public.platform_building_default TO authenticated;
GRANT ALL ON public.platform_building_default TO service_role;

ALTER TABLE public.platform_building_default ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the platform default background"
  ON public.platform_building_default FOR SELECT USING (true);

CREATE POLICY "Platform owners manage the default background"
  ON public.platform_building_default FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE TRIGGER platform_building_default_touch
  BEFORE UPDATE ON public.platform_building_default
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.platform_building_default (id, background) VALUES (true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Only the platform owner writes the default; authenticated writes go through here.
CREATE OR REPLACE FUNCTION public.set_platform_building_default(_background jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin')) THEN
    RAISE EXCEPTION 'not_platform_owner';
  END IF;
  INSERT INTO public.platform_building_default (id, background, updated_by)
  VALUES (true, _background, auth.uid())
  ON CONFLICT (id) DO UPDATE SET background = EXCLUDED.background, updated_by = EXCLUDED.updated_by;
  RETURN _background;
END $function$;