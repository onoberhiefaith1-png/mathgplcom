DROP POLICY IF EXISTS "Class members read timer attempts for their class" ON public.assessment_timer_attempts;

DROP POLICY IF EXISTS "Students manage their own timer attempts" ON public.assessment_timer_attempts;
CREATE POLICY "Students manage their own timer attempts"
  ON public.assessment_timer_attempts
  FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Class owners read timer attempts for their assignments" ON public.assessment_timer_attempts;
CREATE POLICY "Class owners read timer attempts for their assignments"
  ON public.assessment_timer_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assessments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE a.id = assessment_timer_attempts.assessment_id
        AND c.owner_id = auth.uid()
    )
  );