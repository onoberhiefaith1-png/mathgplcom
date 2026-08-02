CREATE TABLE public.class_course_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_course_assignments TO authenticated;
GRANT ALL ON public.class_course_assignments TO service_role;
ALTER TABLE public.class_course_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class owners manage course assignments" ON public.class_course_assignments FOR ALL TO authenticated
  USING (public.is_class_owner(class_id)) WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Class members read course assignments" ON public.class_course_assignments FOR SELECT TO authenticated
  USING (public.is_class_member(class_id) OR public.is_class_owner(class_id));
CREATE TRIGGER class_course_assignments_touch_updated_at BEFORE UPDATE ON public.class_course_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.class_course_settings (
  class_id UUID NOT NULL PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  learning_mode TEXT NOT NULL DEFAULT 'free',
  allow_revisit BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_course_settings TO authenticated;
GRANT ALL ON public.class_course_settings TO service_role;
ALTER TABLE public.class_course_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class owners manage course settings" ON public.class_course_settings FOR ALL TO authenticated
  USING (public.is_class_owner(class_id)) WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Class members read course settings" ON public.class_course_settings FOR SELECT TO authenticated
  USING (public.is_class_member(class_id) OR public.is_class_owner(class_id));
CREATE TRIGGER class_course_settings_touch_updated_at BEFORE UPDATE ON public.class_course_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.student_course_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  progress INTEGER NOT NULL DEFAULT 0,
  score NUMERIC,
  certificate_status TEXT NOT NULL DEFAULT 'none',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_course_progress TO authenticated;
GRANT ALL ON public.student_course_progress TO service_role;
ALTER TABLE public.student_course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage their own course progress" ON public.student_course_progress FOR ALL TO authenticated
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Class owners read course progress" ON public.student_course_progress FOR SELECT TO authenticated
  USING (public.is_class_owner(class_id));
CREATE TRIGGER student_course_progress_touch_updated_at BEFORE UPDATE ON public.student_course_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();