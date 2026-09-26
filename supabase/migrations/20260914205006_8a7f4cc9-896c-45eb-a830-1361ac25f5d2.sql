CREATE TABLE public.slate_games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT 'Untitled Game',
  topic text NOT NULL DEFAULT '',
  subtopic text NOT NULL DEFAULT '',
  surface_id text NOT NULL,
  room_id text NOT NULL,
  background jsonb NOT NULL DEFAULT '{}'::jsonb,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status jsonb NOT NULL DEFAULT '{}'::jsonb,
  pattern_length integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_games TO authenticated;
GRANT ALL ON public.slate_games TO service_role;

ALTER TABLE public.slate_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own slate games"
ON public.slate_games FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.slate_game_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.slate_games(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  notebook_id uuid NOT NULL,
  subsection_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, subsection_id)
);

CREATE INDEX slate_game_questions_game_idx ON public.slate_game_questions (game_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_game_questions TO authenticated;
GRANT ALL ON public.slate_game_questions TO service_role;

ALTER TABLE public.slate_game_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage questions of their own slate games"
ON public.slate_game_questions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.slate_games g WHERE g.id = game_id AND g.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.slate_games g WHERE g.id = game_id AND g.owner_id = auth.uid()));

CREATE TRIGGER slate_games_updated_at
BEFORE UPDATE ON public.slate_games
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER slate_game_questions_updated_at
BEFORE UPDATE ON public.slate_game_questions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();