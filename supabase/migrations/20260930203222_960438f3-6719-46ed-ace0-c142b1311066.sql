ALTER TABLE public.academia_activities
  ADD COLUMN IF NOT EXISTS question_design jsonb,
  ADD COLUMN IF NOT EXISTS question_image_path text;

CREATE TABLE IF NOT EXISTS public.staff_ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  subject_user_id uuid,
  task_id uuid REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'task',
  period_days int,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.staff_ai_reports TO authenticated;
GRANT ALL ON public.staff_ai_reports TO service_role;
ALTER TABLE public.staff_ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read ai reports" ON public.staff_ai_reports FOR SELECT TO authenticated USING (public.staff_is_manager(org_id));
CREATE POLICY "managers write ai reports" ON public.staff_ai_reports FOR INSERT TO authenticated WITH CHECK (public.staff_is_manager(org_id) AND created_by = auth.uid());
CREATE POLICY "managers delete ai reports" ON public.staff_ai_reports FOR DELETE TO authenticated USING (public.staff_is_manager(org_id));
CREATE INDEX IF NOT EXISTS staff_ai_reports_org_idx ON public.staff_ai_reports(org_id, subject_user_id);

CREATE OR REPLACE FUNCTION public.staff_mark_overdue(_org uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT (public.staff_is_manager(_org) OR public.staff_is_member(_org)) THEN RETURN 0; END IF;
  UPDATE public.staff_tasks SET status = 'overdue'
   WHERE org_id = _org AND due_at IS NOT NULL AND due_at < now()
     AND status IN ('assigned','in_progress','changes_requested') AND coalesce(is_template,false) = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.staff_mark_overdue(uuid) TO authenticated;