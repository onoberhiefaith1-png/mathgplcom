CREATE POLICY "Community shared courses are readable"
ON public.courses FOR SELECT TO authenticated
USING (public.is_community_published('course', id));

CREATE POLICY "Community shared course sections are readable"
ON public.course_sections FOR SELECT TO authenticated
USING (public.is_community_published('course', course_id));

CREATE POLICY "Community shared course blocks are readable"
ON public.course_blocks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.course_sections s
  WHERE s.id = course_blocks.section_id
    AND public.is_community_published('course', s.course_id)
));

CREATE POLICY "Community shared course questions are readable"
ON public.course_exercise_questions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.course_blocks b
  JOIN public.course_sections s ON s.id = b.section_id
  WHERE b.id = course_exercise_questions.block_id
    AND public.is_community_published('course', s.course_id)
));