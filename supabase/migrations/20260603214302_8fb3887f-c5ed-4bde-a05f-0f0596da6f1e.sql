ALTER TABLE public.notebooks
  ADD COLUMN IF NOT EXISTS document_json jsonb,
  ADD COLUMN IF NOT EXISTS paper_style text NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS paper_size text NOT NULL DEFAULT 'a4';