
ALTER TABLE public.floating_law_drafts
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS approval_history jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.floating_law_library
  ADD COLUMN IF NOT EXISTS approval_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.floating_assistant_threads
  ADD COLUMN IF NOT EXISTS workspace text NOT NULL DEFAULT 'generation';

CREATE INDEX IF NOT EXISTS floating_assistant_threads_workspace_idx
  ON public.floating_assistant_threads (owner_id, subsection_id, workspace);
