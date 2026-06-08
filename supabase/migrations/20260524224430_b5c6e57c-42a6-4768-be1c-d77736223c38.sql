ALTER TABLE public.notebook_subsections
  ADD COLUMN IF NOT EXISTS floating_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS floating_bucket jsonb;