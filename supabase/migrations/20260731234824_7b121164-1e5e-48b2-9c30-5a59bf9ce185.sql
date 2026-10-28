ALTER TABLE public.notebooks
  ADD COLUMN IF NOT EXISTS storage_scope text NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS origin_notebook_id uuid,
  ADD COLUMN IF NOT EXISTS checkout_link_id uuid,
  ADD COLUMN IF NOT EXISTS cover_config jsonb;

ALTER TABLE public.notebooks
  DROP CONSTRAINT IF EXISTS notebooks_storage_scope_check;
ALTER TABLE public.notebooks
  ADD CONSTRAINT notebooks_storage_scope_check CHECK (storage_scope IN ('workspace','class'));

CREATE INDEX IF NOT EXISTS notebooks_storage_scope_idx ON public.notebooks (owner_id, storage_scope);
CREATE INDEX IF NOT EXISTS notebooks_checkout_link_idx ON public.notebooks (checkout_link_id);