CREATE TABLE public.notebook_slide_decks (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  name text not null default 'Slide Deck',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE INDEX notebook_slide_decks_notebook_idx ON public.notebook_slide_decks(notebook_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_slide_decks TO authenticated;
GRANT ALL ON public.notebook_slide_decks TO service_role;
ALTER TABLE public.notebook_slide_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all notebook slide decks" ON public.notebook_slide_decks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_slide_decks.notebook_id AND n.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_slide_decks.notebook_id AND n.owner_id = auth.uid()));
CREATE POLICY "members read shared notebook slide decks" ON public.notebook_slide_decks FOR SELECT TO authenticated
USING (private.notebook_shared_to_member(notebook_slide_decks.notebook_id));
CREATE POLICY "school reads notebook slide decks" ON public.notebook_slide_decks FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_slide_decks.notebook_id AND n.org_id IS NOT NULL AND is_org_owner(n.org_id) AND n.owner_id <> auth.uid()));

CREATE TRIGGER notebook_slide_decks_touch_updated_at BEFORE UPDATE ON public.notebook_slide_decks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.notebook_slides ADD COLUMN deck_id uuid REFERENCES public.notebook_slide_decks(id) ON DELETE CASCADE;
CREATE INDEX notebook_slides_deck_idx ON public.notebook_slides(deck_id, position);

WITH decks AS (
  INSERT INTO public.notebook_slide_decks (notebook_id, name, position)
  SELECT DISTINCT s.notebook_id, 'Slides', 0 FROM public.notebook_slides s
  RETURNING id, notebook_id
)
UPDATE public.notebook_slides s SET deck_id = d.id
FROM decks d WHERE d.notebook_id = s.notebook_id AND s.deck_id IS NULL;

ALTER TABLE public.notebook_slide_items ADD COLUMN content_json jsonb;
ALTER TABLE public.notebook_slide_items DROP CONSTRAINT IF EXISTS notebook_slide_items_kind_check;
ALTER TABLE public.notebook_slide_items ADD CONSTRAINT notebook_slide_items_kind_check
CHECK (kind IN ('screenshot','image','video','content'));