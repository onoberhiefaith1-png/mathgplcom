ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'lesson';
ALTER TABLE public.adventure_scenes ADD COLUMN IF NOT EXISTS notebook_id uuid REFERENCES public.notebooks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS adventure_scenes_notebook_id_idx ON public.adventure_scenes(notebook_id);