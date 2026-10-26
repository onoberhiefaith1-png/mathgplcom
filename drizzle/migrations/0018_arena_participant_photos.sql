-- Timer Arena: real student pictures.
-- A picture is a small square (≤256px WebP/JPEG, ≤60 KB) stored as a data URL on the
-- participant row. The API validates type, size and file signature before saving and only
-- ever serves it back through /api/public/arena/<code>?action=photo, so no arbitrary URL
-- can reach a screen. No bucket or storage policy is needed.
-- Existing RLS is unchanged: only the group's owner can SELECT participants; everything
-- else goes through the service-role API route.
ALTER TABLE public.arena_participants
  ADD COLUMN IF NOT EXISTS avatar_photo text,
  ADD COLUMN IF NOT EXISTS avatar_photo_at timestamptz;

ALTER TABLE public.arena_participants
  DROP CONSTRAINT IF EXISTS arena_participants_avatar_photo_size;
ALTER TABLE public.arena_participants
  ADD CONSTRAINT arena_participants_avatar_photo_size
  CHECK (avatar_photo IS NULL OR length(avatar_photo) <= 90000);

-- Presence reads (last_seen_at) and the live board both filter by group.
CREATE INDEX IF NOT EXISTS arena_participants_share_seen ON public.arena_participants(share_id, last_seen_at DESC);
