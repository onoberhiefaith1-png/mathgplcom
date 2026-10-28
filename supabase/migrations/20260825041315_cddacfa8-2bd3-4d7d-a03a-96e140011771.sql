ALTER TABLE public.notebook_sections ADD COLUMN IF NOT EXISTS doc_key text;
ALTER TABLE public.notebook_subsections ADD COLUMN IF NOT EXISTS doc_key text;
CREATE INDEX IF NOT EXISTS notebook_sections_doc_key_idx ON public.notebook_sections (notebook_id, doc_key);
CREATE INDEX IF NOT EXISTS notebook_subsections_doc_key_idx ON public.notebook_subsections (section_id, doc_key);