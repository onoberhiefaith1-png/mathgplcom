CREATE TABLE IF NOT EXISTS public.chatgpt_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  command text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chatgpt_commands TO authenticated;
GRANT ALL ON public.chatgpt_commands TO service_role;
ALTER TABLE public.chatgpt_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own commands select" ON public.chatgpt_commands FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own commands insert" ON public.chatgpt_commands FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own commands delete" ON public.chatgpt_commands FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS chatgpt_commands_user_idx ON public.chatgpt_commands(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chatgpt_presence (
  user_id uuid PRIMARY KEY,
  route text NOT NULL DEFAULT '/',
  notebook_id uuid,
  section_label text,
  screen_text text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatgpt_presence TO authenticated;
GRANT ALL ON public.chatgpt_presence TO service_role;
ALTER TABLE public.chatgpt_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own presence all" ON public.chatgpt_presence FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.chatgpt_commands;