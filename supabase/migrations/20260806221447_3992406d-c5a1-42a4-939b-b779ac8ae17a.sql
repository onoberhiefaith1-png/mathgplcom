CREATE TABLE IF NOT EXISTS public.video_adventure_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  started_at timestamptz,
  playhead_seconds double precision NOT NULL DEFAULT 0,
  playing boolean NOT NULL DEFAULT false,
  active_scene_id text,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, game_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_adventure_runs TO authenticated;
GRANT ALL ON public.video_adventure_runs TO service_role;
ALTER TABLE public.video_adventure_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage video adventure runs" ON public.video_adventure_runs FOR ALL TO authenticated
  USING (public.is_class_owner(class_id)) WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Class members read video adventure runs" ON public.video_adventure_runs FOR SELECT TO authenticated
  USING (public.is_class_owner(class_id) OR public.is_class_member(class_id));
CREATE TRIGGER video_adventure_runs_touch_updated_at BEFORE UPDATE ON public.video_adventure_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.video_adventure_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  scene_id text NOT NULL,
  progress_element_id text,
  duration_seconds integer NOT NULL DEFAULT 600,
  required_pct integer NOT NULL DEFAULT 100,
  started_at timestamptz,
  paused_at timestamptz,
  accumulated_paused_ms bigint NOT NULL DEFAULT 0,
  ended_at timestamptz,
  outcome text CHECK (outcome IN ('completed','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, game_id, scene_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_adventure_challenges TO authenticated;
GRANT ALL ON public.video_adventure_challenges TO service_role;
ALTER TABLE public.video_adventure_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage video adventure challenges" ON public.video_adventure_challenges FOR ALL TO authenticated
  USING (public.is_class_owner(class_id)) WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Class members read video adventure challenges" ON public.video_adventure_challenges FOR SELECT TO authenticated
  USING (public.is_class_owner(class_id) OR public.is_class_member(class_id));
CREATE TRIGGER video_adventure_challenges_touch_updated_at BEFORE UPDATE ON public.video_adventure_challenges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.video_adventure_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_adventure_challenges;