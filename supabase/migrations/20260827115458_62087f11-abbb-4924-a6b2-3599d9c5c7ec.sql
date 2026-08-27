CREATE TABLE public.assessment_student_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  board_question_id TEXT,
  body TEXT NOT NULL,
  answer_body TEXT,
  answered_by UUID,
  answered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_asq_assessment ON public.assessment_student_questions (assessment_id, created_at DESC);
CREATE INDEX idx_asq_student ON public.assessment_student_questions (student_user_id, assessment_id);

GRANT SELECT, INSERT, UPDATE ON public.assessment_student_questions TO authenticated;
GRANT ALL ON public.assessment_student_questions TO service_role;

ALTER TABLE public.assessment_student_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students ask questions in their class"
  ON public.assessment_student_questions FOR INSERT TO authenticated
  WITH CHECK (student_user_id = auth.uid() AND public.is_class_member(class_id));

CREATE POLICY "Students read their own questions"
  ON public.assessment_student_questions FOR SELECT TO authenticated
  USING (student_user_id = auth.uid());

CREATE POLICY "Class owners read all class questions"
  ON public.assessment_student_questions FOR SELECT TO authenticated
  USING (public.is_class_owner(class_id));

CREATE POLICY "Class owners answer class questions"
  ON public.assessment_student_questions FOR UPDATE TO authenticated
  USING (public.is_class_owner(class_id))
  WITH CHECK (public.is_class_owner(class_id));

CREATE TRIGGER update_asq_updated_at
  BEFORE UPDATE ON public.assessment_student_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.assessment_student_questions;