CREATE OR REPLACE FUNCTION private.notebook_shared_to_member(_notebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_lesson_notes cln
    JOIN public.class_members cm ON cm.class_id = cln.class_id
    WHERE cln.notebook_id = _notebook_id
      AND cln.visibility = 'student_access_enabled'
      AND cm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.assessments a
    JOIN public.class_members cm ON cm.class_id = a.class_id
    WHERE a.notebook_id = _notebook_id
      AND a.unassigned_at IS NULL
      AND cm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.class_adventure_notes can
    JOIN public.class_members cm ON cm.class_id = can.class_id
    WHERE can.notebook_id = _notebook_id
      AND can.unassigned_at IS NULL
      AND cm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.class_game_boards cgb
    JOIN public.class_members cm ON cm.class_id = cgb.class_id
    WHERE cgb.notebook_id = _notebook_id
      AND cm.user_id = auth.uid()
  )
$$;