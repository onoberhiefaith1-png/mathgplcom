-- Phase 2 (additive): allow soft-unassigning an Adventure lesson note. Set to
-- a timestamp when the teacher unassigns; NULL means active. Preserves any
-- student progress already recorded against linked assessments.
ALTER TABLE public.class_adventure_notes
  ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS class_adventure_notes_active_idx
  ON public.class_adventure_notes (class_id)
  WHERE unassigned_at IS NULL;