-- 1. Class-scoped Game questions -------------------------------------------
ALTER TABLE public.slate_game_questions
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS slate_game_questions_scope_key
  ON public.slate_game_questions (game_id, class_id, subsection_id)
  WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS slate_game_questions_class_idx
  ON public.slate_game_questions (game_id, class_id, position);

-- One-time migration: copy each Game's existing (unscoped) questions into
-- every class currently linked to that Game, as independent rows.
INSERT INTO public.slate_game_questions (game_id, class_id, notebook_id, subsection_id, position)
SELECT q.game_id, a.class_id, q.notebook_id, q.subsection_id, q.position
FROM public.slate_game_questions q
JOIN public.slate_game_assignments a
  ON a.game_id = q.game_id AND a.unassigned_at IS NULL
WHERE q.class_id IS NULL
ON CONFLICT DO NOTHING;

-- 2. Per-instance play settings ---------------------------------------------
ALTER TABLE public.slate_game_assignments
  ADD COLUMN IF NOT EXISTS lock_progression boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS starting_lives integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS level_map_style text NOT NULL DEFAULT 'path';

ALTER TABLE public.slate_game_assignments
  DROP CONSTRAINT IF EXISTS slate_game_assignments_starting_lives_check;
ALTER TABLE public.slate_game_assignments
  ADD CONSTRAINT slate_game_assignments_starting_lives_check
  CHECK (starting_lives BETWEEN 1 AND 5);

ALTER TABLE public.slate_game_assignments
  DROP CONSTRAINT IF EXISTS slate_game_assignments_level_map_style_check;
ALTER TABLE public.slate_game_assignments
  ADD CONSTRAINT slate_game_assignments_level_map_style_check
  CHECK (level_map_style IN ('path', 'art'));

-- 3. Reporting keeps the best marks ever earned ------------------------------
ALTER TABLE public.slate_game_results
  ADD COLUMN IF NOT EXISTS best_marks_earned numeric NOT NULL DEFAULT 0;

UPDATE public.slate_game_results
SET best_marks_earned = GREATEST(best_marks_earned, marks_earned);

-- 4. Progression memory ------------------------------------------------------
ALTER TABLE public.slate_game_progress
  ADD COLUMN IF NOT EXISTS unlocked_question_ids text[] NOT NULL DEFAULT '{}';

-- 5. Access to class-scoped questions ---------------------------------------
DROP POLICY IF EXISTS "class members read game questions" ON public.slate_game_questions;
CREATE POLICY "class members read game questions"
ON public.slate_game_questions
FOR SELECT
TO authenticated
USING (
  class_id IS NOT NULL AND (
    public.is_class_member(class_id)
    OR public.is_class_owner(class_id)
  )
);
