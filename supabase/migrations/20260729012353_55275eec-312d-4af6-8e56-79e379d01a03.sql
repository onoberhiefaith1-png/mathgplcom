CREATE TABLE public.report_task_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'assignment',
  percent numeric NOT NULL DEFAULT 0,
  frozen_score numeric NOT NULL DEFAULT 0,
  frozen_target numeric NOT NULL DEFAULT 0,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_task_results TO authenticated;
GRANT ALL ON public.report_task_results TO service_role;

ALTER TABLE public.report_task_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage class report snapshots"
ON public.report_task_results FOR ALL TO authenticated
USING (public.is_class_owner(class_id))
WITH CHECK (public.is_class_owner(class_id));

CREATE POLICY "Students read their own report snapshots"
ON public.report_task_results FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE TRIGGER report_task_results_touch
BEFORE UPDATE ON public.report_task_results
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();