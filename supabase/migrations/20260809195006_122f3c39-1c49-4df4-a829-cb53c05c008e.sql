-- The School Code: a school's own permanent invitation code. Owner-only read,
-- owner-only regeneration. It identifies the school for a request; it can
-- never sign anybody in and never grants access on its own.
CREATE OR REPLACE FUNCTION public.my_school_code()
RETURNS TABLE(org_id uuid, name text, code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org uuid; v_code text; v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT o.id, o.invite_code, o.name INTO v_org, v_code, v_name
  FROM public.organizations o
  WHERE o.owner_user_id = auth.uid() AND o.kind = 'school'
  ORDER BY o.created_at
  LIMIT 1;
  IF v_org IS NULL THEN RETURN; END IF;
  IF v_code IS NULL THEN
    v_code := public.generate_org_invite_code();
    UPDATE public.organizations SET invite_code = v_code WHERE id = v_org;
  END IF;
  RETURN QUERY SELECT v_org, v_name, v_code;
END $$;

CREATE OR REPLACE FUNCTION public.regenerate_school_code(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.owns_org(_org_id) THEN RAISE EXCEPTION 'not_workspace_owner'; END IF;
  v_code := public.generate_org_invite_code();
  UPDATE public.organizations SET invite_code = v_code WHERE id = _org_id;
  RETURN v_code;
END $$;

-- One lookup for every code a person may be given: a School Code, a permanent
-- MathGPL ID (teacher, student, parent, school) or a personal Share Code.
-- It returns only the name, account type and permanent ID so the sender can
-- confirm who they are about to contact — nothing private is exposed, and
-- resolving a code establishes no relationship whatsoever.
CREATE OR REPLACE FUNCTION public.resolve_account_code(_code text)
RETURNS TABLE(user_id uuid, mathgpl_id text, role app_role, display_name text, org_id uuid, org_name text, matched text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_code := upper(regexp_replace(COALESCE(_code, ''), '\s', '', 'g'));
  IF v_code = '' THEN RETURN; END IF;

  -- 1. A school's own School Code
  RETURN QUERY
  SELECT o.owner_user_id, a.mathgpl_id, COALESCE(a.role, 'school'::app_role),
         COALESCE(NULLIF(o.name, ''), 'MathGPL school'), o.id, o.name, 'school_code'
  FROM public.organizations o
  LEFT JOIN public.account_ids a ON a.user_id = o.owner_user_id
  WHERE o.kind = 'school'
    AND o.invite_code = v_code
    AND o.owner_user_id IS DISTINCT FROM auth.uid()
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 2. A permanent MathGPL ID, with or without its separator
  RETURN QUERY
  SELECT a.user_id, a.mathgpl_id, a.role,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         so.id, so.name, 'mathgpl_id'
  FROM public.account_ids a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  LEFT JOIN public.organizations so
    ON so.owner_user_id = a.user_id AND so.kind = 'school'
  WHERE replace(replace(upper(a.mathgpl_id), '/', ''), '-', '') = replace(replace(v_code, '/', ''), '-', '')
    AND a.user_id <> auth.uid()
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 3. A personal Share Code
  RETURN QUERY
  SELECT a.user_id, a.mathgpl_id, a.role,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         so.id, so.name, 'share_code'
  FROM public.account_ids a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  LEFT JOIN public.organizations so
    ON so.owner_user_id = a.user_id AND so.kind = 'school'
  WHERE a.share_code = v_code
    AND a.user_id <> auth.uid()
  LIMIT 1;
END $$;

REVOKE ALL ON FUNCTION public.my_school_code() FROM anon;
REVOKE ALL ON FUNCTION public.regenerate_school_code(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_account_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_school_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_school_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_account_code(text) TO authenticated;