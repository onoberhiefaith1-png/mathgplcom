-- Skill Builder courses gain a workspace stamp, mirroring lesson notes
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS courses_org_id_idx ON public.courses (org_id);

DROP TRIGGER IF EXISTS courses_stamp_active_org ON public.courses;
CREATE TRIGGER courses_stamp_active_org
BEFORE INSERT ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.stamp_active_org();

-- Lesson note contents: school owner may read the content of notes in its workspace
CREATE POLICY "School reads notebook sections in its workspace"
ON public.notebook_sections FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.notebooks n
  WHERE n.id = notebook_sections.notebook_id
    AND n.org_id IS NOT NULL
    AND public.is_org_owner(n.org_id)
    AND n.owner_id <> auth.uid()
));

CREATE POLICY "School reads notebook subsections in its workspace"
ON public.notebook_subsections FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.notebook_sections s
  JOIN public.notebooks n ON n.id = s.notebook_id
  WHERE s.id = notebook_subsections.section_id
    AND n.org_id IS NOT NULL
    AND public.is_org_owner(n.org_id)
    AND n.owner_id <> auth.uid()
));

CREATE POLICY "School reads notebook blocks in its workspace"
ON public.notebook_blocks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.notebook_sections s
  JOIN public.notebooks n ON n.id = s.notebook_id
  WHERE s.id = notebook_blocks.section_id
    AND n.org_id IS NOT NULL
    AND public.is_org_owner(n.org_id)
    AND n.owner_id <> auth.uid()
));

-- Skill Builder: school owner may read courses created in its workspace
CREATE POLICY "School reads courses in its workspace"
ON public.courses FOR SELECT TO authenticated
USING (
  org_id IS NOT NULL
  AND public.is_org_owner(org_id)
  AND owner_id <> auth.uid()
);

CREATE POLICY "School reads course sections in its workspace"
ON public.course_sections FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.courses c
  WHERE c.id = course_sections.course_id
    AND c.org_id IS NOT NULL
    AND public.is_org_owner(c.org_id)
    AND c.owner_id <> auth.uid()
));

CREATE POLICY "School reads course blocks in its workspace"
ON public.course_blocks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.course_sections s
  JOIN public.courses c ON c.id = s.course_id
  WHERE s.id = course_blocks.section_id
    AND c.org_id IS NOT NULL
    AND public.is_org_owner(c.org_id)
    AND c.owner_id <> auth.uid()
));

-- Smartboard: school owner may watch the board of a connected member's class
CREATE POLICY "School reads member smartboard state"
ON public.class_smartboard_state FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.id = class_smartboard_state.class_id
    AND public.owner_can_access_user(c.owner_id)
));

-- Class detail read-outs
CREATE POLICY "School reads member learning assignments"
ON public.learning_assignments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.id = learning_assignments.class_id
    AND public.owner_can_access_user(c.owner_id)
));

CREATE POLICY "School reads member course progress"
ON public.student_course_progress FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.id = student_course_progress.class_id
    AND public.owner_can_access_user(c.owner_id)
));

CREATE POLICY "School reads member adventure groups"
ON public.adventure_groups FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.id = adventure_groups.class_id
    AND public.owner_can_access_user(c.owner_id)
));
