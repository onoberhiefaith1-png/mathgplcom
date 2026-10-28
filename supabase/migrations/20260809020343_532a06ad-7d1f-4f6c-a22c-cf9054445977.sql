-- 1. Share codes live on the account identity row.
ALTER TABLE public.account_ids ADD COLUMN IF NOT EXISTS share_code text;

CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I, O, 0, 1
  candidate text;
  tries int := 0;
  i int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..9 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.account_ids WHERE share_code = candidate);
    tries := tries + 1;
    IF tries > 30 THEN RAISE EXCEPTION 'Could not generate unique share code'; END IF;
  END LOOP;
  RETURN candidate;
END $$;

UPDATE public.account_ids SET share_code = public.generate_share_code() WHERE share_code IS NULL;

ALTER TABLE public.account_ids ALTER COLUMN share_code SET DEFAULT public.generate_share_code();
ALTER TABLE public.account_ids ALTER COLUMN share_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS account_ids_share_code_key ON public.account_ids (share_code);

-- 2. The immutability trigger must allow the share code to be regenerated,
--    while the MathGPL ID itself stays permanent.
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

-- 3. A school ID is school-independent in format: SC/000001, no acronym.
--    Correct the existing rows once, with the immutability trigger lifted.
ALTER TABLE public.account_ids DISABLE TRIGGER account_ids_no_edit;
UPDATE public.account_ids
SET mathgpl_id = 'SC/' || lpad(seq::text, 6, '0')
WHERE prefix = 'SC' AND mathgpl_id <> 'SC/' || lpad(seq::text, 6, '0');
ALTER TABLE public.account_ids ENABLE TRIGGER account_ids_no_edit;

CREATE OR REPLACE FUNCTION public.issue_account_id(_user_id uuid, _role app_role DEFAULT NULL::app_role)
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

  -- The organization is recorded for reference only; it never enters the ID.
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
END $$;

-- 4. Go Live — discovery only, off by default.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_live boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_go_live(_live boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles SET is_live = _live WHERE user_id = auth.uid();
  RETURN _live;
END $$;

-- 5. My own share code, and regenerating it.
CREATE OR REPLACE FUNCTION public.my_share_code()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT share_code FROM public.account_ids WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.regenerate_my_share_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_code := public.generate_share_code();
  UPDATE public.account_ids SET share_code = v_code WHERE user_id = auth.uid();
  RETURN v_code;
END $$;

-- 6. Resolving a share code reveals an identity, never an email or credential.
CREATE OR REPLACE FUNCTION public.resolve_share_code(_code text)
RETURNS TABLE(user_id uuid, mathgpl_id text, role app_role, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_id,
         a.mathgpl_id,
         a.role,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account')
  FROM public.account_ids a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE auth.uid() IS NOT NULL
    AND a.share_code = upper(regexp_replace(COALESCE(_code, ''), '\s', '', 'g'))
    AND a.user_id <> auth.uid()
  LIMIT 1
$$;
