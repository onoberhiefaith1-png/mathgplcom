-- The Game engine is rebuilt from the upgraded Slate Art: the writing surface now
-- carries its own colour, and every game built on the old engine is cleared so
-- teachers start clean.
ALTER TABLE public.slate_games
  ADD COLUMN IF NOT EXISTS surface_colour TEXT NOT NULL DEFAULT '#f4ead7';

DELETE FROM public.assessments WHERE kind = 'game';
DELETE FROM public.slate_game_progress;
DELETE FROM public.slate_game_questions;
DELETE FROM public.slate_games;

-- Slate decoration (sun images, background music) is uploaded under
-- `<owner>/slate-assets/...` in the shared asset bucket. Anyone signed in may
-- read those decorative files so students see the same slate the teacher built.
DROP POLICY IF EXISTS "Slate decoration readable when signed in" ON storage.objects;
CREATE POLICY "Slate decoration readable when signed in"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'game-assets'
  AND (storage.foldername(name))[2] = 'slate-assets'
);