ALTER TABLE public.slate_game_progress
  ADD COLUMN IF NOT EXISTS vault_reward integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_line_keys text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.slate_game_progress
SET vault_reward = coins
WHERE vault_reward = 0 AND coins <> 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_game_progress TO authenticated;
GRANT ALL ON public.slate_game_progress TO service_role;