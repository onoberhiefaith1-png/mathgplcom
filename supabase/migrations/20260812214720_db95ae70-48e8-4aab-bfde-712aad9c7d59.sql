-- Remove unrestricted self-enrolment into any organization.
DROP POLICY IF EXISTS "Self join as student only" ON public.account_memberships;

-- Joining a workspace as a student now requires the organization's invite code.
CREATE OR REPLACE FUNCTION public.join_org_with_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  SELECT id INTO _org
  FROM public.organizations
  WHERE invite_code IS NOT NULL
    AND upper(btrim(invite_code)) = upper(btrim(_code));

  IF _org IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.account_memberships (user_id, org_id, role, status)
  VALUES (auth.uid(), _org, 'student', 'active')
  ON CONFLICT DO NOTHING;

  RETURN _org;
END;
$$;

REVOKE ALL ON FUNCTION public.join_org_with_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_org_with_invite(text) TO authenticated;
