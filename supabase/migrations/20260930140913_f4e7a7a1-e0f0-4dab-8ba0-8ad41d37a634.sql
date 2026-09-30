ALTER TABLE public.academia_activities
  ADD COLUMN IF NOT EXISTS subsection_id uuid NULL
  REFERENCES public.notebook_subsections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_academia_activities_subsection_id
  ON public.academia_activities (subsection_id);