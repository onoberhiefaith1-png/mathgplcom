
-- Sessions can hold a Multiple-Choice activity alongside Practice/Play and Adventure.
ALTER TABLE public.academia_activities DROP CONSTRAINT academia_activities_kind_check;
ALTER TABLE public.academia_activities ADD CONSTRAINT academia_activities_kind_check
  CHECK (kind = ANY (ARRAY['game','lesson_note','smartboard','adventure','question','mcq']));

-- Question copies assigned from an MCQ paper into one Session activity.
CREATE TABLE public.academia_mcq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.academia_activities(id) ON DELETE CASCADE,
  n integer NOT NULL,
  text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academia_mcq_items_activity_idx ON public.academia_mcq_items(activity_id, position);

ALTER TABLE public.academia_mcq_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.academia_mcq_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.academia_mcq_items TO authenticated;

CREATE POLICY "view mcq items" ON public.academia_mcq_items FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.academia_activities a
    WHERE a.id = academia_mcq_items.activity_id
      AND public.academia_can_view_org(public.academia_org_of_subject(public.academia_subject_of_session(a.session_id)))
  )
);
CREATE POLICY "build mcq items" ON public.academia_mcq_items FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.academia_activities a
    WHERE a.id = academia_mcq_items.activity_id
      AND public.academia_can_build_subject(public.academia_subject_of_session(a.session_id))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.academia_activities a
    WHERE a.id = academia_mcq_items.activity_id
      AND public.academia_can_build_subject(public.academia_subject_of_session(a.session_id))
  )
);
