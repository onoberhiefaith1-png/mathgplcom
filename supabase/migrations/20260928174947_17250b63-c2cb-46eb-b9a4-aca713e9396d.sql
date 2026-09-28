CREATE TABLE public.academia_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  academia_id uuid NOT NULL REFERENCES public.academia(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, academia_id)
);
GRANT SELECT, INSERT, DELETE ON public.academia_enrolments TO authenticated;
GRANT ALL ON public.academia_enrolments TO service_role;
ALTER TABLE public.academia_enrolments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own enrolments read" ON public.academia_enrolments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own enrolments add" ON public.academia_enrolments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.academia a WHERE a.id = academia_id AND public.academia_can_view_org(a.org_id)));
CREATE POLICY "own enrolments remove" ON public.academia_enrolments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.discover_academias(_q text DEFAULT '')
RETURNS TABLE(id uuid, org_id uuid, name text, description text, cover_path text, presentation_path text, visibility text, school_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.org_id, a.name, a.description, a.cover_path, a.presentation_path, a.visibility, o.name
  FROM academia a JOIN organizations o ON o.id = a.org_id
  WHERE (a.visibility = 'public' OR is_org_owner(a.org_id) OR is_workspace_member(a.org_id))
    AND (coalesce(_q,'') = '' OR a.name ILIKE '%'||_q||'%' OR o.name ILIKE '%'||_q||'%')
  ORDER BY a.name LIMIT 60
$$;
REVOKE EXECUTE ON FUNCTION public.discover_academias(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.discover_academias(text) TO authenticated;