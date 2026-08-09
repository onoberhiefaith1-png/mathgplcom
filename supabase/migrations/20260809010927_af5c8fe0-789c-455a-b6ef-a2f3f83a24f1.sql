CREATE OR REPLACE FUNCTION public.mathgpl_id_for_email(_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.mathgpl_id
  FROM auth.users u
  JOIN public.account_ids a ON a.user_id = u.id
  WHERE lower(u.email) = lower(_email)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.mathgpl_id_for_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mathgpl_id_for_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.mathgpl_id_for_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mathgpl_id_for_email(text) TO service_role;