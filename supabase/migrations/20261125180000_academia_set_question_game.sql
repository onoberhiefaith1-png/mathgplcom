-- Let the school owner, the question's author, the session's author, or a
-- teacher assigned to the subject set ONE question's game. Visitors cannot.
-- The function writes game_id and this question's class membership only.
-- It does not change the question, other questions, or the game itself.

CREATE OR REPLACE FUNCTION public.academia_set_question_game(_activity uuid, _game uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_session uuid;
  v_created uuid;
  v_class uuid;
  v_subsection uuid;
  v_notebook uuid;
  v_session_created uuid;
  v_owner uuid;
  v_library boolean;
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;
  IF _game IS NULL THEN
    RAISE EXCEPTION 'not_your_game';
  END IF;

  SELECT kind, session_id, created_by, class_id, subsection_id, ref_id
    INTO v_kind, v_session, v_created, v_class, v_subsection, v_notebook
  FROM public.academia_activities
  WHERE id = _activity;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_kind IS DISTINCT FROM 'question' THEN
    RAISE EXCEPTION 'not_eligible';
  END IF;

  SELECT created_by INTO v_session_created
  FROM public.academia_sessions
  WHERE id = v_session;

  v_allowed :=
    public.is_org_owner(public.academia_org_of_session(v_session))
    OR v_created = auth.uid()
    OR v_session_created = auth.uid()
    OR public.academia_can_build_subject(public.academia_subject_of_session(v_session));
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT owner_id, COALESCE(library, false)
    INTO v_owner, v_library
  FROM public.slate_games
  WHERE id = _game;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'not_your_game';
  END IF;
  IF v_owner IS DISTINCT FROM auth.uid() AND NOT v_library THEN
    RAISE EXCEPTION 'not_your_game';
  END IF;

  UPDATE public.academia_activities
  SET game_id = _game
  WHERE id = _activity;

  IF v_class IS NOT NULL AND v_subsection IS NOT NULL AND v_notebook IS NOT NULL THEN
    INSERT INTO public.slate_game_assignments (game_id, class_id, created_by, pass_percentage)
    VALUES (_game, v_class, auth.uid(), 100)
    ON CONFLICT (game_id, class_id) DO UPDATE
      SET unassigned_at = NULL;

    INSERT INTO public.slate_game_questions (game_id, class_id, notebook_id, subsection_id, position)
    SELECT _game, v_class, v_notebook, v_subsection,
      COALESCE((
        SELECT count(*)::integer
        FROM public.slate_game_questions q
        WHERE q.game_id = _game AND q.class_id = v_class
      ), 0)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.slate_game_questions q
      WHERE q.game_id = _game
        AND q.class_id = v_class
        AND q.subsection_id = v_subsection
    );
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.academia_set_question_game(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_set_question_game(uuid, uuid) TO authenticated, service_role;
