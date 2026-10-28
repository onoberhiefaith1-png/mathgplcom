CREATE OR REPLACE FUNCTION public.course_assigned_to_my_class(_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_course_assignments a
    WHERE a.course_id = _course_id
      AND (
        EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = a.class_id AND m.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = a.class_id AND c.owner_id = auth.uid())
      )
  )
$$;

CREATE POLICY "Class members read assigned courses"
ON public.courses FOR SELECT TO authenticated
USING (public.course_assigned_to_my_class(id));

CREATE POLICY "Class members read assigned course sections"
ON public.course_sections FOR SELECT TO authenticated
USING (public.course_assigned_to_my_class(course_id));

CREATE POLICY "Class members read assigned course blocks"
ON public.course_blocks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.course_sections s
  WHERE s.id = course_blocks.section_id
    AND public.course_assigned_to_my_class(s.course_id)
));