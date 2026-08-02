CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled course',
  subject TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  subtopic TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  background_kind TEXT NOT NULL DEFAULT 'none',
  background_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  learning_mode TEXT NOT NULL DEFAULT 'locked',
  completion_mode TEXT NOT NULL DEFAULT 'retracement',
  pass_mark INTEGER NOT NULL DEFAULT 80,
  deadline_days INTEGER NOT NULL DEFAULT 21,
  learning_days INTEGER NOT NULL DEFAULT 20,
  certificate_mode TEXT NOT NULL DEFAULT 'automatic',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their courses" ON public.courses FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Published courses are readable" ON public.courses FOR SELECT TO authenticated USING (status = 'published');
CREATE TRIGGER courses_touch_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.course_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled section',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_sections TO authenticated;
GRANT ALL ON public.course_sections TO service_role;
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their course sections" ON public.course_sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.owner_id = auth.uid()));
CREATE POLICY "Published course sections are readable" ON public.course_sections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.status = 'published'));
CREATE TRIGGER course_sections_touch_updated_at BEFORE UPDATE ON public.course_sections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.course_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_blocks TO authenticated;
GRANT ALL ON public.course_blocks TO service_role;
ALTER TABLE public.course_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their course blocks" ON public.course_blocks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_sections s JOIN public.courses c ON c.id = s.course_id WHERE s.id = section_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.course_sections s JOIN public.courses c ON c.id = s.course_id WHERE s.id = section_id AND c.owner_id = auth.uid()));
CREATE POLICY "Published course blocks are readable" ON public.course_blocks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_sections s JOIN public.courses c ON c.id = s.course_id WHERE s.id = section_id AND c.status = 'published'));
CREATE TRIGGER course_blocks_touch_updated_at BEFORE UPDATE ON public.course_blocks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.course_exercise_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id UUID NOT NULL REFERENCES public.course_blocks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  notebook_id UUID,
  subsection_id UUID,
  section_id UUID,
  question_key TEXT,
  label TEXT NOT NULL DEFAULT '',
  total_marks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_exercise_questions TO authenticated;
GRANT ALL ON public.course_exercise_questions TO service_role;
ALTER TABLE public.course_exercise_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their course exercise questions" ON public.course_exercise_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_blocks b JOIN public.course_sections s ON s.id = b.section_id JOIN public.courses c ON c.id = s.course_id WHERE b.id = block_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.course_blocks b JOIN public.course_sections s ON s.id = b.section_id JOIN public.courses c ON c.id = s.course_id WHERE b.id = block_id AND c.owner_id = auth.uid()));
CREATE POLICY "Published course exercise questions are readable" ON public.course_exercise_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_blocks b JOIN public.course_sections s ON s.id = b.section_id JOIN public.courses c ON c.id = s.course_id WHERE b.id = block_id AND c.status = 'published'));
CREATE TRIGGER course_exercise_questions_touch_updated_at BEFORE UPDATE ON public.course_exercise_questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- storage bucket + object policies are created separately