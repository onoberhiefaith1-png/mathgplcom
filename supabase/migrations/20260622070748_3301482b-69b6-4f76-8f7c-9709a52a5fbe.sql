
-- Generations: one row per Generate click on an equation line
CREATE TABLE public.floating_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id UUID,
  subsection_id UUID,
  line_id TEXT,
  original TEXT NOT NULL,
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  law_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  chips JSONB NOT NULL DEFAULT '[]'::jsonb,
  scaffolds JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_generations TO authenticated;
GRANT ALL ON public.floating_generations TO service_role;
ALTER TABLE public.floating_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own floating generations"
  ON public.floating_generations FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Approved law library
CREATE TABLE public.floating_law_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  law_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  rule TEXT NOT NULL,
  reason TEXT,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  exceptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_generation_id UUID REFERENCES public.floating_generations(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, law_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_law_library TO authenticated;
GRANT ALL ON public.floating_law_library TO service_role;
ALTER TABLE public.floating_law_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any signed-in user can read floating laws"
  ON public.floating_law_library FOR SELECT TO authenticated USING (true);
CREATE POLICY "owners manage own floating laws"
  ON public.floating_law_library FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update own floating laws"
  ON public.floating_law_library FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners delete own floating laws"
  ON public.floating_law_library FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Draft (pending) law proposals
CREATE TABLE public.floating_law_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_generation_id UUID REFERENCES public.floating_generations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule TEXT NOT NULL,
  reason TEXT,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  exceptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_law_drafts TO authenticated;
GRANT ALL ON public.floating_law_drafts TO service_role;
ALTER TABLE public.floating_law_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own floating law drafts"
  ON public.floating_law_drafts FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Restructure event audit trail
CREATE TABLE public.floating_restructure_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES public.floating_generations(id) ON DELETE CASCADE,
  input_kind TEXT NOT NULL,
  instruction TEXT,
  scope JSONB,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_restructure_events TO authenticated;
GRANT ALL ON public.floating_restructure_events TO service_role;
ALTER TABLE public.floating_restructure_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own floating restructure events"
  ON public.floating_restructure_events FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Reuse touch_updated_at trigger
CREATE TRIGGER trg_floating_generations_updated BEFORE UPDATE ON public.floating_generations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_floating_law_library_updated BEFORE UPDATE ON public.floating_law_library
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_floating_law_drafts_updated BEFORE UPDATE ON public.floating_law_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_floating_generations_owner_sub ON public.floating_generations(owner_id, subsection_id);
CREATE INDEX idx_floating_law_drafts_owner_status ON public.floating_law_drafts(owner_id, status);
