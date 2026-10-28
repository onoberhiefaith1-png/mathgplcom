CREATE TABLE public.class_gallery_awards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL,
  game_id uuid NOT NULL,
  reward_element_id text NOT NULL,
  group_id uuid,
  awarded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX class_gallery_awards_unique_group
  ON public.class_gallery_awards (class_id, game_id, reward_element_id, group_id)
  WHERE group_id IS NOT NULL;

CREATE UNIQUE INDEX class_gallery_awards_unique_whole_class
  ON public.class_gallery_awards (class_id, game_id, reward_element_id)
  WHERE group_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_gallery_awards TO authenticated;
GRANT ALL ON public.class_gallery_awards TO service_role;

ALTER TABLE public.class_gallery_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class members can view awards"
ON public.class_gallery_awards FOR SELECT TO authenticated
USING (public.is_class_owner(class_id) OR public.is_class_member(class_id));

CREATE POLICY "Class members can record awards"
ON public.class_gallery_awards FOR INSERT TO authenticated
WITH CHECK (public.is_class_owner(class_id) OR public.is_class_member(class_id));

CREATE POLICY "Class owner can update awards"
ON public.class_gallery_awards FOR UPDATE TO authenticated
USING (public.is_class_owner(class_id))
WITH CHECK (public.is_class_owner(class_id));

CREATE POLICY "Class owner can delete awards"
ON public.class_gallery_awards FOR DELETE TO authenticated
USING (public.is_class_owner(class_id));

CREATE TRIGGER class_gallery_awards_touch_updated_at
BEFORE UPDATE ON public.class_gallery_awards
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();