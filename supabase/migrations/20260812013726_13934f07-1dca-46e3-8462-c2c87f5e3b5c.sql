CREATE OR REPLACE FUNCTION public.issue_account_id_for_email(_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
  SELECT u.id INTO v_uid FROM auth.users u
  WHERE lower(u.email) = lower(trim(_email)) ORDER BY u.created_at LIMIT 1;
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  RETURN public.issue_account_id(v_uid, NULL);
END $$;

REVOKE ALL ON FUNCTION public.issue_account_id_for_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_account_id_for_email(text) TO service_role;