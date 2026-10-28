CREATE TABLE public.custom_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  short_code text NOT NULL,
  section text NOT NULL,
  source text NOT NULL DEFAULT 'ai',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX custom_assets_owner_short_code_key
  ON public.custom_assets (owner_id, upper(short_code));
CREATE INDEX custom_assets_owner_idx ON public.custom_assets (owner_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_assets TO authenticated;
GRANT ALL ON public.custom_assets TO service_role;

ALTER TABLE public.custom_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_assets_owner_all"
  ON public.custom_assets FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER custom_assets_touch_updated_at
  BEFORE UPDATE ON public.custom_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Is this source currently published in MathGPL Community?
CREATE OR REPLACE FUNCTION public.is_community_published(_kind text, _source_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_resources r
    WHERE r.source_id = _source_id
      AND r.kind::text = _kind
      AND r.status = 'published'
  )
$$;

REVOKE ALL ON FUNCTION public.is_community_published(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_community_published(text, uuid) TO authenticated;

CREATE POLICY "notebooks_read_when_community_published"
  ON public.notebooks FOR SELECT TO authenticated
  USING (public.is_community_published('lesson_note', id));

CREATE POLICY "notebook_sections_read_when_community_published"
  ON public.notebook_sections FOR SELECT TO authenticated
  USING (public.is_community_published('lesson_note', notebook_id));

CREATE POLICY "notebook_subsections_read_when_community_published"
  ON public.notebook_subsections FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notebook_sections s
    WHERE s.id = notebook_subsections.section_id
      AND public.is_community_published('lesson_note', s.notebook_id)
  ));

CREATE POLICY "notebook_blocks_read_when_community_published"
  ON public.notebook_blocks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notebook_sections s
    WHERE s.id = notebook_blocks.section_id
      AND public.is_community_published('lesson_note', s.notebook_id)
  ));

CREATE POLICY "games_read_when_community_published"
  ON public.games FOR SELECT TO authenticated
  USING (public.is_community_published('adventure', id));