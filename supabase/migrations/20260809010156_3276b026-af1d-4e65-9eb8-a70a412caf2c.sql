-- Permanent MathGPL identifiers -------------------------------------------
-- One row per account, issued once, never reassigned, never edited.

CREATE SEQUENCE IF NOT EXISTS public.account_seq_adm START 1;
CREATE SEQUENCE IF NOT EXISTS public.account_seq_sc  START 1;
CREATE SEQUENCE IF NOT EXISTS public.account_seq_tch START 1;
CREATE SEQUENCE IF NOT EXISTS public.account_seq_stu START 1;
CREATE SEQUENCE IF NOT EXISTS public.account_seq_par START 1;

CREATE TABLE public.account_ids (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  role public.app_role NOT NULL,
  prefix text NOT NULL,
  acronym text,
  seq bigint NOT NULL,
  mathgpl_id text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_ids TO authenticated;
GRANT ALL ON public.account_ids TO service_role;

ALTER TABLE public.account_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own MathGPL ID is readable"
ON public.account_ids FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Administrators read every MathGPL ID"
ON public.account_ids FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE POLICY "Workspace owners read their members' MathGPL IDs"
ON public.account_ids FOR SELECT TO authenticated
USING (public.owner_can_access_user(user_id));

-- An issued identifier is permanent.
CREATE OR REPLACE FUNCTION public.account_ids_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mathgpl_id IS DISTINCT FROM OLD.mathgpl_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.seq IS DISTINCT FROM OLD.seq
     OR NEW.prefix IS DISTINCT FROM OLD.prefix THEN
    RAISE EXCEPTION 'a MathGPL ID is permanent and cannot be changed';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER account_ids_no_edit
BEFORE UPDATE ON public.account_ids
FOR EACH ROW EXECUTE FUNCTION public.account_ids_immutable();

-- Short code for a school, derived from its name: Oxford Academy -> OX.
CREATE OR REPLACE FUNCTION public.school_acronym(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  words text[];
  code text := '';
  w text;
BEGIN
  words := regexp_split_to_array(
    trim(regexp_replace(upper(COALESCE(_name, '')), '[^A-Z ]', ' ', 'g')), '\s+');
  FOREACH w IN ARRAY COALESCE(words, ARRAY[]::text[]) LOOP
    IF length(w) > 0 THEN code := code || left(w, 1); END IF;
    EXIT WHEN length(code) >= 3;
  END LOOP;
  IF length(code) < 2 AND length(COALESCE(words[1], '')) >= 2 THEN
    code := left(words[1], 2);
  END IF;
  IF length(code) = 0 THEN code := 'SCH'; END IF;
  RETURN code;
END $$;

-- Issues (or returns) the permanent MathGPL ID of an account.
CREATE OR REPLACE FUNCTION public.issue_account_id(_user_id uuid, _role public.app_role DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing text;
  v_role public.app_role;
  v_prefix text;
  v_seq bigint;
  v_org uuid;
  v_name text;
  v_code text;
  v_base text;
  v_n int := 1;
  v_id text;
BEGIN
  SELECT mathgpl_id INTO v_existing FROM public.account_ids WHERE user_id = _user_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_role := COALESCE(
    _role,
    (SELECT role FROM public.user_roles WHERE user_id = _user_id
      ORDER BY CASE role
        WHEN 'platform_owner' THEN 0 WHEN 'co_admin' THEN 1 WHEN 'school' THEN 2
        WHEN 'teacher' THEN 3 WHEN 'parent' THEN 4 ELSE 5 END
      LIMIT 1),
    'teacher');

  v_prefix := CASE v_role
    WHEN 'platform_owner' THEN 'ADM'
    WHEN 'co_admin' THEN 'ADM'
    WHEN 'school' THEN 'SC'
    WHEN 'teacher' THEN 'TCH'
    WHEN 'parent' THEN 'PAR'
    ELSE 'STU' END;

  IF v_prefix = 'SC' THEN
    SELECT o.id, o.name INTO v_org, v_name
    FROM public.organizations o
    WHERE o.owner_user_id = _user_id AND o.kind = 'school'
    ORDER BY o.created_at LIMIT 1;
    v_base := public.school_acronym(COALESCE(v_name, 'School'));
    v_code := v_base;
    WHILE EXISTS (
      SELECT 1 FROM public.account_ids a
      WHERE a.prefix = 'SC' AND a.acronym = v_code
        AND (v_org IS NULL OR a.org_id IS DISTINCT FROM v_org)
    ) LOOP
      v_n := v_n + 1;
      v_code := v_base || v_n::text;
    END LOOP;
  END IF;

  v_seq := nextval('public.account_seq_' || lower(v_prefix));
  v_id := CASE WHEN v_prefix = 'SC'
    THEN 'SC/' || v_code || '/' || lpad(v_seq::text, 6, '0')
    ELSE v_prefix || '/' || lpad(v_seq::text, 6, '0') END;

  INSERT INTO public.account_ids (user_id, org_id, role, prefix, acronym, seq, mathgpl_id)
  VALUES (_user_id, v_org, v_role, v_prefix, v_code, v_seq, v_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT mathgpl_id INTO v_existing FROM public.account_ids WHERE user_id = _user_id;
  RETURN v_existing;
END $$;

REVOKE ALL ON FUNCTION public.issue_account_id(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_account_id(uuid, public.app_role) TO service_role;

-- New accounts receive their identifier at signup.
CREATE OR REPLACE FUNCTION public.handle_new_user_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_role public.app_role;
  v_org uuid;
  v_name text;
BEGIN
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'account_role',''), 'teacher')::public.app_role;
  IF v_role NOT IN ('school','teacher','parent','student') THEN
    v_role := 'teacher';
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
END $$;

-- Existing accounts keep all their data and receive an ID in the new format.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT ur.user_id,
           (ARRAY_AGG(ur.role ORDER BY CASE ur.role
              WHEN 'platform_owner' THEN 0 WHEN 'co_admin' THEN 1 WHEN 'school' THEN 2
              WHEN 'teacher' THEN 3 WHEN 'parent' THEN 4 ELSE 5 END))[1] AS role,
           MIN(ur.created_at) AS joined
    FROM public.user_roles ur
    GROUP BY ur.user_id
    ORDER BY MIN(ur.created_at)
  LOOP
    PERFORM public.issue_account_id(r.user_id, r.role);
  END LOOP;
END $$;