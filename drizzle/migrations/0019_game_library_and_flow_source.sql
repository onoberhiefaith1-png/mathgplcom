ALTER TABLE public.slate_games
  ADD COLUMN IF NOT EXISTS library boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.slate_games.library IS
  'Public Game Library sample. The row itself is the source everyone uses.';

CREATE INDEX IF NOT EXISTS slate_games_library_idx
  ON public.slate_games (updated_at DESC)
  WHERE library = true;

CREATE OR REPLACE FUNCTION public.guard_slate_game_library()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.library, false) IS TRUE AND NOT public.is_flow_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an administrator can publish a Game Library sample';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slate_games_library_guard ON public.slate_games;
CREATE TRIGGER slate_games_library_guard
  BEFORE INSERT OR UPDATE OF library ON public.slate_games
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_slate_game_library();

DROP POLICY IF EXISTS "Library games are readable" ON public.slate_games;
CREATE POLICY "Library games are readable"
  ON public.slate_games FOR SELECT TO authenticated
  USING (library = true);

DROP POLICY IF EXISTS "Admins update library games" ON public.slate_games;
CREATE POLICY "Admins update library games"
  ON public.slate_games FOR UPDATE TO authenticated
  USING (library = true AND public.is_flow_admin(auth.uid()))
  WITH CHECK (public.is_flow_admin(auth.uid()));

DROP POLICY IF EXISTS "Library game questions are readable" ON public.slate_game_questions;
CREATE POLICY "Library game questions are readable"
  ON public.slate_game_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.slate_games g WHERE g.id = slate_game_questions.game_id AND g.library = true));

DROP POLICY IF EXISTS "Class owners manage questions on library games" ON public.slate_game_questions;
CREATE POLICY "Class owners manage questions on library games"
  ON public.slate_game_questions FOR ALL TO authenticated
  USING (
    class_id IS NOT NULL AND public.is_class_owner(class_id)
    AND EXISTS (SELECT 1 FROM public.slate_games g WHERE g.id = slate_game_questions.game_id AND g.library = true)
  )
  WITH CHECK (
    class_id IS NOT NULL AND public.is_class_owner(class_id)
    AND EXISTS (SELECT 1 FROM public.slate_games g WHERE g.id = game_id AND g.library = true)
  );

DROP POLICY IF EXISTS "Published flow sources are readable" ON public.flows;
CREATE POLICY "Published flow sources are readable"
  ON public.flows FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.flows lib WHERE lib.source_flow_id = flows.id AND lib.scope = 'mathgpl' AND lib.status = 'published'));