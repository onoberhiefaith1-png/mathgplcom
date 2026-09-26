-- Add optional document-section reference to lesson-note structure rows.
-- Additive only: no data changes, no constraint changes, no RLS changes.
-- Already applied to the live database; kept here so the repo matches it.

ALTER TABLE public.notebook_sections
  ADD COLUMN IF NOT EXISTS doc_section_id text;

ALTER TABLE public.notebook_subsections
  ADD COLUMN IF NOT EXISTS doc_section_id text;

CREATE INDEX IF NOT EXISTS notebook_sections_doc_section_id_idx
  ON public.notebook_sections USING btree (doc_section_id);

CREATE INDEX IF NOT EXISTS notebook_subsections_doc_section_id_idx
  ON public.notebook_subsections USING btree (doc_section_id);
