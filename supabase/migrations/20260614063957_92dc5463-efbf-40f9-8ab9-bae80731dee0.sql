
-- Adventure Games
CREATE TABLE public.adventure_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  topic text,
  subtopic text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_games TO authenticated;
GRANT ALL ON public.adventure_games TO service_role;
ALTER TABLE public.adventure_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their adventure games"
  ON public.adventure_games FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Adventure Scenes
CREATE TABLE public.adventure_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.adventure_games(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('obstacle','door','vault')),
  title text,
  background_ref jsonb,
  layout_json jsonb NOT NULL DEFAULT '{"items":[]}'::jsonb,
  required_progress integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX adventure_scenes_game_idx ON public.adventure_scenes(game_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_scenes TO authenticated;
GRANT ALL ON public.adventure_scenes TO service_role;
ALTER TABLE public.adventure_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage scenes of their games"
  ON public.adventure_scenes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.adventure_games g WHERE g.id = game_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.adventure_games g WHERE g.id = game_id AND g.owner_id = auth.uid()));

-- Adventure Scene Questions
CREATE TABLE public.adventure_scene_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES public.adventure_scenes(id) ON DELETE CASCADE,
  vault_id text,
  order_index integer NOT NULL DEFAULT 0,
  question_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  marks integer NOT NULL DEFAULT 10,
  claim_once boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX adventure_scene_questions_scene_idx ON public.adventure_scene_questions(scene_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_scene_questions TO authenticated;
GRANT ALL ON public.adventure_scene_questions TO service_role;
ALTER TABLE public.adventure_scene_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage questions of their scenes"
  ON public.adventure_scene_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.adventure_scenes s
    JOIN public.adventure_games g ON g.id = s.game_id
    WHERE s.id = scene_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.adventure_scenes s
    JOIN public.adventure_games g ON g.id = s.game_id
    WHERE s.id = scene_id AND g.owner_id = auth.uid()));

-- updated_at triggers (reuse existing touch_updated_at())
CREATE TRIGGER trg_adventure_games_updated
  BEFORE UPDATE ON public.adventure_games
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_adventure_scenes_updated
  BEFORE UPDATE ON public.adventure_scenes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_adventure_scene_questions_updated
  BEFORE UPDATE ON public.adventure_scene_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
