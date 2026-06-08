-- Restrict the sensitive join_code column to owners only via a SECURITY DEFINER RPC.
REVOKE SELECT (join_code) ON public.classes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_class_join_code(_class_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT join_code FROM public.classes
  WHERE id = _class_id AND owner_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_class_join_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_owned_class_codes()
RETURNS TABLE(id uuid, join_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, join_code FROM public.classes WHERE owner_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_owned_class_codes() TO authenticated;