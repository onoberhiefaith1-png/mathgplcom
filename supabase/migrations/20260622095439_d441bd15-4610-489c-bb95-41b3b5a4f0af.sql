-- Floating ↔ Lesson Note integration

-- 1) Per-example structural analyses (auto-run when a worked example is generated/edited)
CREATE TABLE public.floating_example_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notebook_id uuid,
  subsection_id uuid,
  block_id uuid,
  example_text text NOT NULL,
  structures jsonb NOT NULL DEFAULT '[]'::jsonb,
  detected_elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  lesson_topic text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_example_analyses TO authenticated;
GRANT ALL ON public.floating_example_analyses TO service_role;
ALTER TABLE public.floating_example_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage their analyses"
  ON public.floating_example_analyses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_floating_example_analyses_subsection
  ON public.floating_example_analyses(subsection_id);
CREATE INDEX idx_floating_example_analyses_user
  ON public.floating_example_analyses(user_id);

-- 2) Topic + tag metadata so laws can be filtered by current lesson topic
ALTER TABLE public.floating_law_library
  ADD COLUMN IF NOT EXISTS lesson_topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.floating_law_drafts
  ADD COLUMN IF NOT EXISTS lesson_topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'ai_proposed'
    CHECK (source_kind IN ('ai_proposed','teacher_authored','derived_from_correction'));

-- 3) Capture reason + law refs on every restructure / correction event
ALTER TABLE public.floating_restructure_events
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS law_refs uuid[] NOT NULL DEFAULT '{}';
