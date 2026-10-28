ALTER TABLE public.academia_sessions
  ADD COLUMN lesson_note_id uuid NULL REFERENCES public.notebooks(id) ON DELETE SET NULL;

CREATE INDEX academia_sessions_lesson_note_id_idx
  ON public.academia_sessions (lesson_note_id);

ALTER TABLE public.academia_activities
  ADD COLUMN practice_video jsonb NULL,
  ADD COLUMN play_video jsonb NULL;

ALTER TABLE public.guest_links
  DROP CONSTRAINT guest_links_kind_check;

ALTER TABLE public.guest_links
  ADD CONSTRAINT guest_links_kind_check
  CHECK (kind = ANY (ARRAY['course'::text, 'assignment'::text, 'game'::text, 'academia_session'::text]));

CREATE OR REPLACE FUNCTION public.validate_academia_session_guest_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'academia_session' THEN
    IF NEW.class_id IS NOT NULL THEN
      RAISE EXCEPTION 'Academia session guest links cannot be class-scoped';
    END IF;
    IF NOT public.academia_can_build_subject(public.academia_subject_of_session(NEW.resource_id)) THEN
      RAISE EXCEPTION 'Not permitted to share this Academia session';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_academia_session_guest_link() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_academia_session_guest_link() TO service_role;

CREATE TRIGGER validate_academia_session_guest_link_before_write
BEFORE INSERT OR UPDATE OF kind, resource_id, class_id
ON public.guest_links
FOR EACH ROW
EXECUTE FUNCTION public.validate_academia_session_guest_link();