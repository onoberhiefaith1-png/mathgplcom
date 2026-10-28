-- Pictures placed inside a building frame or window are uploaded under the
-- uploader's own folder (`<uid>/building-frames/<frame id>/<file>`), which the
-- shared asset bucket already allows. This adds the missing READ path: anybody
-- who may view the building the frame belongs to may also see the picture in it.
-- Purely additive: no existing policy is dropped or changed.

CREATE OR REPLACE FUNCTION public.frame_object_building(_name TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.building_id
  FROM public.building_frames f
  WHERE (storage.foldername(_name))[2] = 'building-frames'
    AND f.id::text = (storage.foldername(_name))[3]
$$;

REVOKE EXECUTE ON FUNCTION public.frame_object_building(TEXT) FROM anon;

CREATE POLICY "Frame pictures readable by building viewers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'game-assets'
  AND (storage.foldername(name))[2] = 'building-frames'
  AND public.can_view_building(public.frame_object_building(name))
);