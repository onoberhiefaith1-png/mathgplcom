-- ========== Group Bars ==========
CREATE TABLE public.adventure_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  name text NOT NULL,
  progress_element_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, game_id, progress_element_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_groups TO authenticated;
GRANT ALL ON public.adventure_groups TO service_role;
ALTER TABLE public.adventure_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class owners manage adventure groups"
  ON public.adventure_groups FOR ALL TO authenticated
  USING (public.is_class_owner(class_id))
  WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Class members read adventure groups"
  ON public.adventure_groups FOR SELECT TO authenticated
  USING (public.is_class_member(class_id));

CREATE TABLE public.adventure_group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.adventure_groups(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  student_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, game_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_group_members TO authenticated;
GRANT ALL ON public.adventure_group_members TO service_role;
ALTER TABLE public.adventure_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class owners manage adventure group members"
  ON public.adventure_group_members FOR ALL TO authenticated
  USING (public.is_class_owner(class_id))
  WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Class members read adventure group members"
  ON public.adventure_group_members FOR SELECT TO authenticated
  USING (public.is_class_member(class_id));

-- ========== Class Gallery ==========
CREATE TABLE public.class_galleries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL UNIQUE REFERENCES public.classes(id) ON DELETE CASCADE,
  canvas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_galleries TO authenticated;
GRANT ALL ON public.class_galleries TO service_role;
ALTER TABLE public.class_galleries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class owners manage the class gallery"
  ON public.class_galleries FOR ALL TO authenticated
  USING (public.is_class_owner(class_id))
  WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Class members read the class gallery"
  ON public.class_galleries FOR SELECT TO authenticated
  USING (public.is_class_member(class_id));
CREATE POLICY "Class members create the class gallery"
  ON public.class_galleries FOR INSERT TO authenticated
  WITH CHECK (public.is_class_member(class_id));

CREATE TABLE public.class_gallery_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  reward_element_id text NOT NULL,
  asset_id uuid,
  storage_path text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  source text NOT NULL DEFAULT 'storage',
  start_x double precision NOT NULL DEFAULT 0,
  start_y double precision NOT NULL DEFAULT 0,
  end_x double precision NOT NULL DEFAULT 0,
  end_y double precision NOT NULL DEFAULT 0,
  scale double precision NOT NULL DEFAULT 1,
  rotation double precision NOT NULL DEFAULT 0,
  opacity double precision NOT NULL DEFAULT 1,
  duration_ms integer NOT NULL DEFAULT 2000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, game_id, reward_element_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_gallery_rewards TO authenticated;
GRANT ALL ON public.class_gallery_rewards TO service_role;
ALTER TABLE public.class_gallery_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class owners manage class gallery rewards"
  ON public.class_gallery_rewards FOR ALL TO authenticated
  USING (public.is_class_owner(class_id))
  WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Class members read class gallery rewards"
  ON public.class_gallery_rewards FOR SELECT TO authenticated
  USING (public.is_class_member(class_id));

CREATE TRIGGER trg_adventure_groups_touch BEFORE UPDATE ON public.adventure_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_class_galleries_touch BEFORE UPDATE ON public.class_galleries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_class_gallery_rewards_touch BEFORE UPDATE ON public.class_gallery_rewards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();