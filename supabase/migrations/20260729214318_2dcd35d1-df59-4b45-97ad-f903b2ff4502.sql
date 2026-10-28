ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS lesson_note_levels text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE public.class_content_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.class_content_nodes(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('curriculum','syllabus','scheme')),
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_content_nodes_class ON public.class_content_nodes(class_id, level, parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_content_nodes TO authenticated;
GRANT ALL ON public.class_content_nodes TO service_role;

ALTER TABLE public.class_content_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class owners manage content nodes"
ON public.class_content_nodes FOR ALL TO authenticated
USING (public.is_class_owner(class_id))
WITH CHECK (public.is_class_owner(class_id));

CREATE POLICY "Class members view content nodes"
ON public.class_content_nodes FOR SELECT TO authenticated
USING (public.is_class_member(class_id));

CREATE TRIGGER class_content_nodes_touch
BEFORE UPDATE ON public.class_content_nodes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.class_lesson_notes
  ADD COLUMN IF NOT EXISTS node_id uuid REFERENCES public.class_content_nodes(id) ON DELETE SET NULL;