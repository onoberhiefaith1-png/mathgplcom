ALTER TABLE public.academia_activities ADD COLUMN IF NOT EXISTS link_code text;

CREATE TABLE public.academia_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.academia_sessions(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.academia_activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  mode text NOT NULL CHECK (mode IN ('practice','play')),
  score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  best_score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, mode)
);
GRANT SELECT, INSERT, UPDATE ON public.academia_attempts TO authenticated;
GRANT ALL ON public.academia_attempts TO service_role;
ALTER TABLE public.academia_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.academia_org_of_session(_session uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT academia_org_of_subject(academia_subject_of_session(_session)) $$;
REVOKE EXECUTE ON FUNCTION public.academia_org_of_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_org_of_session(uuid) TO authenticated;

CREATE POLICY "own academia attempts" ON public.academia_attempts FOR ALL TO authenticated
  USING (user_id = auth.uid() AND academia_can_view_org(academia_org_of_session(session_id)))
  WITH CHECK (user_id = auth.uid() AND academia_can_view_org(academia_org_of_session(session_id)));
CREATE POLICY "school and builders read attempts" ON public.academia_attempts FOR SELECT TO authenticated
  USING (is_org_owner(academia_org_of_session(session_id))
      OR academia_can_build_subject(academia_subject_of_session(session_id)));

CREATE TRIGGER academia_attempts_touch BEFORE UPDATE ON public.academia_attempts
  FOR EACH ROW EXECUTE FUNCTION public.academia_touch();

-- Keep "<School name> Academia" in step with the school name.
CREATE OR REPLACE FUNCTION public.academia_follow_org_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE academia SET name = coalesce(NEW.name,'School') || ' Academia' WHERE org_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.academia_follow_org_name() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER organizations_academia_name AFTER UPDATE OF name ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.academia_follow_org_name();