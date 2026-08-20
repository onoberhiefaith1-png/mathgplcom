CREATE TABLE public.notebook_copilot_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  subtopic TEXT NOT NULL DEFAULT '',
  cycle INTEGER NOT NULL DEFAULT 1,
  structure JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis JSONB,
  queue JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage TEXT NOT NULL DEFAULT 'greeting',
  current_item TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (notebook_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_copilot_sessions TO authenticated;
GRANT ALL ON public.notebook_copilot_sessions TO service_role;

ALTER TABLE public.notebook_copilot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their own copilot sessions"
ON public.notebook_copilot_sessions FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notebook_copilot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.notebook_copilot_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  payload JSONB,
  cycle INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_copilot_messages TO authenticated;
GRANT ALL ON public.notebook_copilot_messages TO service_role;

ALTER TABLE public.notebook_copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their own copilot messages"
ON public.notebook_copilot_messages FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_copilot_messages_session ON public.notebook_copilot_messages (session_id, created_at);

CREATE OR REPLACE FUNCTION public.touch_copilot_session_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_notebook_copilot_sessions_updated_at
BEFORE UPDATE ON public.notebook_copilot_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_copilot_session_updated_at();