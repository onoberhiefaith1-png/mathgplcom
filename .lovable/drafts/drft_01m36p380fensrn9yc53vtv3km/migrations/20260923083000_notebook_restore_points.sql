-- Restore points for a lesson note.
--
-- Before the assistant repairs a badly arranged note, it stores the whole
-- structure (sections, sessions, lines) here so the teacher can put the note
-- back exactly as it was if the repair goes wrong.

CREATE TABLE IF NOT EXISTS public.notebook_restore_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Before repair',
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notebook_restore_points_notebook_idx
  ON public.notebook_restore_points (notebook_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_restore_points TO authenticated;
GRANT ALL ON public.notebook_restore_points TO service_role;

ALTER TABLE public.notebook_restore_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their own restore points"
  ON public.notebook_restore_points
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners create their own restore points"
  ON public.notebook_restore_points
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners delete their own restore points"
  ON public.notebook_restore_points
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
