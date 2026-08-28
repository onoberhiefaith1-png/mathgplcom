-- Permission follows the REFERENCE: if you may open a course that points at
-- this asset, you may stream the one original object. No copies, ever.
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
  IF auth.uid() IS NULL OR _path IS NULL OR _path = '' THEN
    RETURN false;
  END IF;

  -- 1. The uploader always reads their own folder.
  IF owner_txt = auth.uid()::text THEN
    RETURN true;
  END IF;

  -- 2. The course the file was uploaded for.
  BEGIN
    course_uuid := course_txt::uuid;
  EXCEPTION WHEN others THEN
    course_uuid := NULL;
  END;

  IF course_uuid IS NOT NULL AND (
       public.course_assigned_to_my_class(course_uuid)
       OR public.is_community_published('course', course_uuid)
     ) THEN
    RETURN true;
  END IF;

  -- 3. Any course this viewer may open that references the same asset —
  --    e.g. a Community copy, or a copy assigned to their own class.
  IF EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.background_url = _path
      AND (
        c.owner_id = auth.uid()
        OR public.course_assigned_to_my_class(c.id)
        OR public.is_community_published('course', c.id)
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.course_blocks b
    JOIN public.course_sections s ON s.id = b.section_id
    JOIN public.courses c ON c.id = s.course_id
    WHERE b.config::text LIKE '%' || _path || '%'
      AND (
        c.owner_id = auth.uid()
        OR public.course_assigned_to_my_class(c.id)
        OR public.is_community_published('course', c.id)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_watch_course_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_watch_course_media(text) TO authenticated, service_role;