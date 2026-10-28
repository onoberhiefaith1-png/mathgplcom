CREATE TABLE IF NOT EXISTS public.learning_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  question_keys uuid[] NOT NULL DEFAULT '{}',
  mode text NOT NULL DEFAULT 'assignment',
  status text NOT NULL DEFAULT 'active',
  title text,
  due_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_assignments_mode_chk CHECK (mode IN ('assignment','adventure')),
  CONSTRAINT learning_assignments_status_chk CHECK (status IN ('active','archived'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_assignments TO authenticated;
GRANT ALL ON public.learning_assignments TO service_role;

ALTER TABLE public.learning_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class owners manage learning assignments"
  ON public.learning_assignments FOR ALL TO authenticated
  USING (public.is_class_owner(class_id))
  WITH CHECK (public.is_class_owner(class_id));

CREATE POLICY "Class members read learning assignments"
  ON public.learning_assignments FOR SELECT TO authenticated
  USING (public.is_class_member(class_id));

CREATE UNIQUE INDEX IF NOT EXISTS learning_assignments_active_triple_idx
  ON public.learning_assignments (
    class_id,
    notebook_id,
    COALESCE(game_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS learning_assignments_class_status_idx
  ON public.learning_assignments (class_id, status);

CREATE TRIGGER learning_assignments_touch
  BEFORE UPDATE ON public.learning_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.learning_assignments(id) ON DELETE SET NULL;
ALTER TABLE public.class_adventure_notes ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.learning_assignments(id) ON DELETE SET NULL;
ALTER TABLE public.class_game_boards ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.learning_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assessments_assignment_idx ON public.assessments (assignment_id);
CREATE INDEX IF NOT EXISTS class_adventure_notes_assignment_idx ON public.class_adventure_notes (assignment_id);
CREATE INDEX IF NOT EXISTS class_game_boards_assignment_idx ON public.class_game_boards (assignment_id);

-- Backfill: one parent instance per existing active (class, notebook, mode) pair.
INSERT INTO public.learning_assignments (class_id, notebook_id, game_id, mode, status, question_keys, created_by, created_at)
SELECT a.class_id,
       a.notebook_id,
       NULL,
       'assignment',
       'active',
       COALESCE(array_agg(a.question_key) FILTER (WHERE a.question_key IS NOT NULL), '{}'),
       MIN(a.owner_id::text)::uuid,
       MIN(a.created_at)
FROM public.assessments a
WHERE a.unassigned_at IS NULL
  AND a.notebook_id IS NOT NULL
  AND a.kind <> 'adventure'
GROUP BY a.class_id, a.notebook_id
ON CONFLICT DO NOTHING;

UPDATE public.assessments a
SET assignment_id = la.id
FROM public.learning_assignments la
WHERE a.assignment_id IS NULL
  AND a.unassigned_at IS NULL
  AND a.kind <> 'adventure'
  AND la.mode = 'assignment'
  AND la.status = 'active'
  AND la.class_id = a.class_id
  AND la.notebook_id = a.notebook_id;

INSERT INTO public.learning_assignments (class_id, notebook_id, game_id, mode, status, question_keys, due_at, created_by, created_at)
SELECT n.class_id,
       n.notebook_id,
       NULL,
       'adventure',
       'active',
       COALESCE(array_agg(n.question_key) FILTER (WHERE n.question_key IS NOT NULL), '{}'),
       MIN(n.due_at),
       MIN(n.assigned_by::text)::uuid,
       MIN(n.created_at)
FROM public.class_adventure_notes n
WHERE n.unassigned_at IS NULL
GROUP BY n.class_id, n.notebook_id
ON CONFLICT DO NOTHING;

UPDATE public.class_adventure_notes n
SET assignment_id = la.id
FROM public.learning_assignments la
WHERE n.assignment_id IS NULL
  AND n.unassigned_at IS NULL
  AND la.mode = 'adventure'
  AND la.status = 'active'
  AND la.class_id = n.class_id
  AND la.notebook_id = n.notebook_id;

UPDATE public.class_game_boards b
SET assignment_id = la.id
FROM public.learning_assignments la
WHERE b.assignment_id IS NULL
  AND b.notebook_id IS NOT NULL
  AND la.status = 'active'
  AND la.class_id = b.class_id
  AND la.notebook_id = b.notebook_id;