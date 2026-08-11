-- 1. Backfill missing account types from the permanent ID table
INSERT INTO public.user_roles (user_id, role)
SELECT a.user_id, a.role
FROM public.account_ids a
WHERE a.role IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = a.user_id)
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Account type lookups fall back to the permanent ID's recorded role
CREATE OR REPLACE FUNCTION public.account_role_of(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = _user_id
      ORDER BY CASE role
        WHEN 'platform_owner' THEN 0 WHEN 'co_admin' THEN 1 WHEN 'school' THEN 2
        WHEN 'teacher' THEN 3 WHEN 'parent' THEN 4 ELSE 5 END
      LIMIT 1),
    (SELECT role FROM public.account_ids WHERE user_id = _user_id LIMIT 1)
  )
$function$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.account_role_of(auth.uid())
$function$;

-- 3. Issuing an ID always records the matching account type
CREATE OR REPLACE FUNCTION public.issue_account_id(_user_id uuid, _role app_role DEFAULT NULL::app_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  v_role := COALESCE(
    _role,
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

-- 4. Security: a teacher's law library is private to that teacher
DROP POLICY IF EXISTS "any signed-in user can read floating laws" ON public.floating_law_library;
CREATE POLICY "owners read own floating laws"
ON public.floating_law_library FOR SELECT TO authenticated
USING (auth.uid() = owner_id);