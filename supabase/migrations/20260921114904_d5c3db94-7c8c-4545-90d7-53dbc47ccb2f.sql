-- 1. Slate decoration files: owner only (class members keep their own policy)
DROP POLICY IF EXISTS "Slate decoration readable when signed in" ON storage.objects;
CREATE POLICY "Slate decoration readable by owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'game-assets'
  AND (storage.foldername(name))[2] = 'slate-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Exact reference matching for course media
CREATE OR REPLACE FUNCTION public.can_watch_course_media(_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  owner_txt text := split_part(_path, '/', 1);
  course_txt text := split_part(_path, '/', 2);
  course_uuid uuid;
BEGIN
  IF auth.uid() IS NULL OR _path IS NULL OR _path = '' THEN
    RETURN false;
  END IF;

  IF owner_txt = auth.uid()::text THEN
    RETURN true;
  END IF;

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

  -- Exact reference lookup inside the block configuration (no text LIKE match).
  RETURN EXISTS (
    SELECT 1
    FROM public.course_blocks b
    JOIN public.course_sections s ON s.id = b.section_id
    JOIN public.courses c ON c.id = s.course_id
    WHERE (
        b.config->>'videoPath' = _path
        OR b.config->>'backgroundUrl' = _path
        OR EXISTS (
          SELECT 1
          FROM jsonb_each(COALESCE(b.config->'questionVideos', '{}'::jsonb)) AS qv(key, value)
          WHERE jsonb_typeof(qv.value) = 'object'
            AND qv.value->>'videoPath' = _path
        )
      )
      AND (
        c.owner_id = auth.uid()
        OR public.course_assigned_to_my_class(c.id)
        OR public.is_community_published('course', c.id)
      )
  );
END;
$function$;

-- 3. Asset usage entries: managers only
DROP POLICY IF EXISTS "gpl_usage_log" ON public.gpl_asset_usage;

-- 4. Internal trigger helpers are not callable from the API
REVOKE EXECUTE ON FUNCTION public.page_guides_touch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.referral_settle_subscription() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.speed_capture_record() FROM anon, authenticated;