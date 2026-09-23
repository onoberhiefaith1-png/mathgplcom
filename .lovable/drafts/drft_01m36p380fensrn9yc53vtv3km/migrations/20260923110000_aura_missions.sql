-- Autonomous System Exploration: one mission, with the record the assistant
-- keeps of her own exploration (what she knows, what she does not, what she
-- tried, what failed, her questions and the supervisor's corrections).

CREATE TABLE IF NOT EXISTS public.aura_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  ledger jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aura_missions_user_idx
  ON public.aura_missions (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aura_missions TO authenticated;
GRANT ALL ON public.aura_missions TO service_role;

ALTER TABLE public.aura_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their own missions"
  ON public.aura_missions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners create their own missions"
  ON public.aura_missions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners update their own missions"
  ON public.aura_missions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners delete their own missions"
  ON public.aura_missions FOR DELETE TO authenticated
  USING (user_id = auth.uid());
