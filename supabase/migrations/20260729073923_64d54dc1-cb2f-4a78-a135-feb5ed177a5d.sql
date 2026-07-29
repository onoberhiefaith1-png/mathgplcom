CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  notebook_id uuid REFERENCES public.notebooks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 60,
  time_zone text NOT NULL DEFAULT 'UTC',
  visibility text NOT NULL DEFAULT 'private',
  status text NOT NULL DEFAULT 'draft',
  session_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_owner_idx ON public.sessions(owner_id);
CREATE UNIQUE INDEX sessions_class_idx ON public.sessions(class_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their sessions"
ON public.sessions FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Participants can view their sessions"
ON public.sessions FOR SELECT TO authenticated
USING (public.is_class_member(class_id));

CREATE POLICY "Anyone signed in can view public published sessions"
ON public.sessions FOR SELECT TO authenticated
USING (visibility = 'public' AND status IN ('published','live','ended'));

CREATE TRIGGER sessions_touch_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.generate_session_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  LOOP
    candidate := upper(substr(replace(encode(gen_random_bytes(8),'base64'), '/', 'A'), 1, 6));
    candidate := regexp_replace(candidate, '[^A-Z0-9]', 'X', 'g');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sessions WHERE session_code = candidate);
    tries := tries + 1;
    IF tries > 20 THEN RAISE EXCEPTION 'Could not generate unique session code'; END IF;
  END LOOP;
  RETURN candidate;
END $$;

CREATE OR REPLACE FUNCTION public.lookup_session_by_code(code text)
RETURNS TABLE(id uuid, class_id uuid, title text, starts_at timestamptz, duration_minutes integer, owner_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.class_id, s.title, s.starts_at, s.duration_minutes, s.owner_id
  FROM public.sessions s
  WHERE s.session_code = upper(code)
  LIMIT 1
$$;