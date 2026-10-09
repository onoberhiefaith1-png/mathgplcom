-- Offline Academia app: attempts recorded on a learner's device, synced when online.
CREATE TABLE IF NOT EXISTS public.academia_device_attempts (
  id uuid PRIMARY KEY,
  device_id uuid NOT NULL,
  activity_id uuid NOT NULL REFERENCES public.academia_activities(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.academia_sessions(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('practice','play')),
  score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_academia_device_attempts_session ON public.academia_device_attempts(session_id);
ALTER TABLE public.academia_device_attempts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.academia_device_attempts TO authenticated;
GRANT ALL ON public.academia_device_attempts TO service_role;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='academia_device_attempts' AND policyname='builders read device attempts') THEN
    CREATE POLICY "builders read device attempts" ON public.academia_device_attempts FOR SELECT TO authenticated
      USING (is_org_owner(academia_org_of_session(session_id)) OR academia_can_build_subject(academia_subject_of_session(session_id)));
  END IF;
END $$;
