CREATE OR REPLACE FUNCTION public.is_published_flow_source(_flow_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flows lib
    WHERE lib.source_flow_id = _flow_id
      AND lib.scope = 'mathgpl'
      AND lib.status = 'published'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_published_flow_source(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_published_flow_source(uuid) TO authenticated;

DROP POLICY IF EXISTS "Published flow sources are readable" ON public.flows;
CREATE POLICY "Published flow sources are readable"
  ON public.flows FOR SELECT TO authenticated
  USING (public.is_published_flow_source(id));