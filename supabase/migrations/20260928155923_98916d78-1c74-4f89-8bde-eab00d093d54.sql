CREATE OR REPLACE FUNCTION public.academia_subject_of_subtopic(_subtopic uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT t.subject_id FROM academia_subtopics s JOIN academia_topics t ON t.id=s.topic_id WHERE s.id=_subtopic $$;
CREATE TABLE public.academia_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id uuid NOT NULL REFERENCES public.academia_subtopics(id) ON DELETE CASCADE,
  title text NOT NULL,
  video_url text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academia_sessions TO authenticated;
GRANT ALL ON public.academia_sessions TO service_role;
ALTER TABLE public.academia_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view sessions" ON public.academia_sessions FOR SELECT TO authenticated
  USING (academia_can_view_org(academia_org_of_subject(academia_subject_of_subtopic(subtopic_id))));
CREATE POLICY "teachers build sessions" ON public.academia_sessions FOR ALL TO authenticated
  USING (academia_can_build_subject(academia_subject_of_subtopic(subtopic_id)))
  WITH CHECK (academia_can_build_subject(academia_subject_of_subtopic(subtopic_id)));

CREATE OR REPLACE FUNCTION public.academia_subject_of_session(_session uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT academia_subject_of_subtopic(subtopic_id) FROM academia_sessions WHERE id=_session $$;

CREATE TABLE public.academia_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.academia_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('game','lesson_note','smartboard','adventure','question')),
  ref_id uuid NOT NULL,
  title text NOT NULL,
  difficulty text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academia_activities TO authenticated;
GRANT ALL ON public.academia_activities TO service_role;
ALTER TABLE public.academia_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view activities" ON public.academia_activities FOR SELECT TO authenticated
  USING (academia_can_view_org(academia_org_of_subject(academia_subject_of_session(session_id))));
CREATE POLICY "teachers build activities" ON public.academia_activities FOR ALL TO authenticated
  USING (academia_can_build_subject(academia_subject_of_session(session_id)))
  WITH CHECK (academia_can_build_subject(academia_subject_of_session(session_id)));

CREATE TRIGGER academia_sessions_touch BEFORE UPDATE ON public.academia_sessions FOR EACH ROW EXECUTE FUNCTION public.academia_touch();
CREATE TRIGGER academia_activities_touch BEFORE UPDATE ON public.academia_activities FOR EACH ROW EXECUTE FUNCTION public.academia_touch();
REVOKE EXECUTE ON FUNCTION public.academia_subject_of_subtopic(uuid), public.academia_subject_of_session(uuid) FROM anon;