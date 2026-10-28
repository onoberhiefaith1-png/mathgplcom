ALTER TABLE public.smart_cards
  ADD COLUMN IF NOT EXISTS game_progress_element_id text,
  ADD COLUMN IF NOT EXISTS pass_mark_pct integer NOT NULL DEFAULT 100;

CREATE TABLE IF NOT EXISTS public.smart_card_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.smart_cards(id) ON DELETE CASCADE,
  participant_key text NOT NULL,
  display_name text,
  score integer NOT NULL DEFAULT 0,
  required_marks integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  qualified_at timestamptz,
  completion_ms bigint,
  is_winner boolean NOT NULL DEFAULT false,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, participant_key)
);

GRANT SELECT ON public.smart_card_game_results TO authenticated;
GRANT ALL ON public.smart_card_game_results TO service_role;

ALTER TABLE public.smart_card_game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Card owners can view game results"
ON public.smart_card_game_results
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.smart_cards c
  WHERE c.id = smart_card_game_results.card_id AND c.owner_id = auth.uid()
));

CREATE TRIGGER smart_card_game_results_touch
BEFORE UPDATE ON public.smart_card_game_results
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();