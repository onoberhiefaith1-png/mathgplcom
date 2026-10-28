CREATE TABLE public.notebook_subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  document_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notebook_subtopics_notebook_idx ON public.notebook_subtopics(notebook_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_subtopics TO authenticated;
GRANT ALL ON public.notebook_subtopics TO service_role;
ALTER TABLE public.notebook_subtopics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all subtopics" ON public.notebook_subtopics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_id AND n.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_id AND n.owner_id = auth.uid()));
CREATE POLICY "members read shared subtopics" ON public.notebook_subtopics FOR SELECT TO authenticated
  USING (private.notebook_shared_to_member(notebook_id));
CREATE POLICY "school reads subtopics in workspace" ON public.notebook_subtopics FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_id AND n.org_id IS NOT NULL AND public.is_org_owner(n.org_id)));
ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS active_subtopic_id uuid;
INSERT INTO public.notebook_subtopics (notebook_id, name, order_index)
  SELECT n.id, n.subtopic, 0 FROM public.notebooks n WHERE coalesce(trim(n.subtopic), '') <> '';
UPDATE public.notebooks n SET active_subtopic_id = s.id FROM public.notebook_subtopics s WHERE s.notebook_id = n.id;