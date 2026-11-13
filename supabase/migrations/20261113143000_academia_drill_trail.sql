-- Per-user Academia drill-down (class, subject, topic, subtopic, last session).
-- A signed-in user can read and write only their own row. There is no expiry:
-- the trail follows the account across devices, the website and the installed
-- app, including after logout and across long gaps.
-- This file is not applied to the live database by the change that adds it.

CREATE TABLE IF NOT EXISTS public.academia_drill_trails (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  academia_id uuid,
  class_id uuid,
  subject_id uuid,
  topic_id uuid,
  subtopic_id uuid,
  session_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.academia_drill_trails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academia_drill_trails FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.academia_drill_trails TO authenticated;

DROP POLICY IF EXISTS "academia drill trail select own" ON public.academia_drill_trails;
CREATE POLICY "academia drill trail select own"
  ON public.academia_drill_trails
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "academia drill trail insert own" ON public.academia_drill_trails;
CREATE POLICY "academia drill trail insert own"
  ON public.academia_drill_trails
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "academia drill trail update own" ON public.academia_drill_trails;
CREATE POLICY "academia drill trail update own"
  ON public.academia_drill_trails
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.academia_drill_trails_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.academia_drill_trails_stamp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS academia_drill_trails_stamp ON public.academia_drill_trails;
CREATE TRIGGER academia_drill_trails_stamp
  BEFORE INSERT OR UPDATE ON public.academia_drill_trails
  FOR EACH ROW EXECUTE FUNCTION public.academia_drill_trails_stamp();
