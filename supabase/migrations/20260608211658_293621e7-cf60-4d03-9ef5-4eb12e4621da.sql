-- 1. Active student column on the shared smartboard state
ALTER TABLE public.class_smartboard_state
  ADD COLUMN IF NOT EXISTS active_student_id uuid;

-- 2. Allow the currently selected active student to update the board state
DROP POLICY IF EXISTS "Active student writes board state" ON public.class_smartboard_state;
CREATE POLICY "Active student writes board state"
  ON public.class_smartboard_state
  FOR UPDATE
  USING (active_student_id = auth.uid() AND is_class_member(class_id))
  WITH CHECK (active_student_id = auth.uid() AND is_class_member(class_id));

-- 3. Ensure realtime carries full row data for filters
ALTER TABLE public.class_smartboard_state REPLICA IDENTITY FULL;
ALTER TABLE public.class_lesson_notes REPLICA IDENTITY FULL;
ALTER TABLE public.classes REPLICA IDENTITY FULL;

-- 4. Add tables to the realtime publication (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_smartboard_state;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_lesson_notes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;