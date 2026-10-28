-- Course media (videos, covers) live at `<owner_uid>/<course_id>/<file>` in the
-- private `course-media` bucket. Store once, reference many: sharing a course
-- grants *permission* to stream the original object, never a copy.
CREATE OR REPLACE FUNCTION public.can_watch_course_media(_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_txt text := split_part(_path, '/', 1);
  course_txt text := split_part(_path, '/', 2);
  course_uuid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  -- The owner always reads their own folder.
  IF owner_txt = auth.uid()::text THEN
    RETURN true;
  END IF;
  BEGIN
    course_uuid := course_txt::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN public.course_assigned_to_my_class(course_uuid)
      OR public.is_community_published('course', course_uuid);
END;
$$;

REVOKE ALL ON FUNCTION public.can_watch_course_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_watch_course_media(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Course media shared read" ON storage.objects;
CREATE POLICY "Course media shared read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'course-media' AND public.can_watch_course_media(name));