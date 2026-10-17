-- Subject-level multiple-choice papers (JAMB/WAEC/NECO...) and student attempts.
CREATE TABLE IF NOT EXISTS public.academia_mcq_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.academia_subjects(id) ON DELETE CASCADE,
  source_notebook_id uuid,
  title text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, source_notebook_id)
);
CREATE INDEX IF NOT EXISTS academia_mcq_papers_subject_idx ON public.academia_mcq_papers(subject_id);

GRANT SELECT ON public.academia_mcq_papers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academia_mcq_papers TO authenticated;
GRANT ALL ON public.academia_mcq_papers TO service_role;
ALTER TABLE public.academia_mcq_papers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.academia_subject_is_public(_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM academia_subjects s
    JOIN academia_classes c ON c.id = s.class_id
    JOIN academia a ON a.id = c.academia_id
    WHERE s.id = _subject AND a.visibility = 'public')
$$;

CREATE POLICY "view mcq papers" ON public.academia_mcq_papers FOR SELECT
  USING (public.academia_subject_is_public(subject_id)
         OR public.academia_can_view_org(public.academia_org_of_subject(subject_id)));
CREATE POLICY "build mcq papers" ON public.academia_mcq_papers FOR ALL TO authenticated
  USING (public.academia_can_build_subject(subject_id) OR public.is_org_owner(public.academia_org_of_subject(subject_id)))
  WITH CHECK (public.academia_can_build_subject(subject_id) OR public.is_org_owner(public.academia_org_of_subject(subject_id)));

CREATE TABLE IF NOT EXISTS public.academia_mcq_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.academia_mcq_papers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  correct integer NOT NULL DEFAULT 0,
  incorrect integer NOT NULL DEFAULT 0,
  unanswered integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academia_mcq_attempts_user_idx ON public.academia_mcq_attempts(user_id, paper_id);

GRANT SELECT, INSERT ON public.academia_mcq_attempts TO authenticated;
GRANT ALL ON public.academia_mcq_attempts TO service_role;
ALTER TABLE public.academia_mcq_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mcq attempts read" ON public.academia_mcq_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own mcq attempts insert" ON public.academia_mcq_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
