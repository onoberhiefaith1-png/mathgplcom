CREATE OR REPLACE FUNCTION public.room_screen_object_building(_name TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.building_id
  FROM public.building_classrooms c
  WHERE (storage.foldername(_name))[1] = 'room-screens'
    AND c.id::text = (storage.foldername(_name))[2]
$$;

REVOKE EXECUTE ON FUNCTION public.room_screen_object_building(TEXT) FROM anon;

CREATE POLICY "Room screen videos readable by building viewers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'game-assets'
  AND (storage.foldername(name))[1] = 'room-screens'
  AND public.can_view_building(public.room_screen_object_building(name))
);

CREATE POLICY "Room screen videos written by building editors"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'game-assets'
  AND (storage.foldername(name))[1] = 'room-screens'
  AND public.can_edit_building(public.room_screen_object_building(name))
);

CREATE POLICY "Room screen videos updated by building editors"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'game-assets'
  AND (storage.foldername(name))[1] = 'room-screens'
  AND public.can_edit_building(public.room_screen_object_building(name))
);

CREATE POLICY "Room screen videos removed by building editors"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'game-assets'
  AND (storage.foldername(name))[1] = 'room-screens'
  AND public.can_edit_building(public.room_screen_object_building(name))
);