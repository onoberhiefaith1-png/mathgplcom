-- Math Lab Stage 12: cloud-saved scenes shared with classes.
-- Additive only: two new tables, RLS, grants. No existing table is altered.

CREATE TABLE public.math_lab_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  org_id uuid,
  name text NOT NULL,
  snapshot jsonb NOT NULL,
  controls jsonb NOT NULL DEFAULT '{"editEquations": true, "tools": true, "console": false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.math_lab_scene_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES public.math_lab_scenes(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scene_id, class_id)
);

CREATE INDEX math_lab_scenes_owner_idx ON public.math_lab_scenes(owner_id);
CREATE INDEX math_lab_scene_shares_scene_idx ON public.math_lab_scene_shares(scene_id);
CREATE INDEX math_lab_scene_shares_class_idx ON public.math_lab_scene_shares(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_lab_scenes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_lab_scene_shares TO authenticated;
GRANT ALL ON public.math_lab_scenes TO service_role;
GRANT ALL ON public.math_lab_scene_shares TO service_role;

ALTER TABLE public.math_lab_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.math_lab_scene_shares ENABLE ROW LEVEL SECURITY;

-- Owners manage their own scenes.
CREATE POLICY math_lab_scenes_owner_all ON public.math_lab_scenes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Students (and teachers) in a shared class can read the scene.
CREATE POLICY math_lab_scenes_shared_read ON public.math_lab_scenes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.math_lab_scene_shares s
    WHERE s.scene_id = id AND public.is_class_member(s.class_id)
  ));

-- Scene owners manage shares; class owners of a shared class can read them.
CREATE POLICY math_lab_scene_shares_owner_all ON public.math_lab_scene_shares
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.math_lab_scenes sc WHERE sc.id = scene_id AND sc.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.math_lab_scenes sc WHERE sc.id = scene_id AND sc.owner_id = auth.uid()));

CREATE POLICY math_lab_scene_shares_member_read ON public.math_lab_scene_shares
  FOR SELECT TO authenticated
  USING (public.is_class_member(class_id) OR public.is_class_owner(class_id));
