-- Policy checks for 20261117120000_academia_owner_or_creator_write.sql.
-- Requires a school Academia (same fixture rule as academia_deep_duplicate.sql).
-- This file never commits fixture data: the wrapper always rolls back.
--
-- How to run (after Lovable or supabase db has applied the migration):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/academia_owner_or_creator_write.sql
-- Colleague-teacher cases run only when the school already has a second
-- active teacher membership. If none exists, those cases are skipped with
-- a NOTICE; create/assign a second teacher and re-run to cover them.
--
-- Manual checks if the rollback test cannot be used:
--  1. School owner can rename/delete any topic, subtopic, session, activity.
--  2. The teacher who created a topic (created_by) can rename/delete it;
--     another assigned teacher cannot, but can still INSERT a new topic.
--  3. A row with created_by IS NULL is owner-only for UPDATE/DELETE.
--  4. created_by cannot be changed.
--  5. Session creator can update/delete/reorder activities they did not
--     add; an activity's own creator can update/delete that activity only;
--     a third assigned teacher cannot reorder.
--  6. Duplicate of a topic succeeds for the owner or the creating teacher; an assigned colleague cannot duplicate it (see 20261117180000).
--  7. Classes/subjects remain owner-only (a teacher cannot UPDATE them).

DO $academia_fixture_rollback$
DECLARE failure text;
BEGIN
  BEGIN
    EXECUTE $academia_fixture_body$
DO $$
DECLARE
  actor uuid; acad uuid; org uuid; teacher uuid; outsider uuid := gen_random_uuid();
  c uuid := gen_random_uuid(); s uuid := gen_random_uuid();
  t_owner uuid := gen_random_uuid(); t_null uuid := gen_random_uuid(); t_teacher uuid := gen_random_uuid();
  u uuid := gen_random_uuid(); se uuid := gen_random_uuid();
  act_owner uuid := gen_random_uuid(); act_teacher uuid := gen_random_uuid();
  ok boolean; n integer;
BEGIN
  SELECT a.id, a.org_id, o.owner_user_id INTO acad, org, actor
    FROM public.academia a JOIN public.organizations o ON o.id = a.org_id
   WHERE o.kind = 'school' LIMIT 1;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'An existing school Academia is required for rollback-only validation.';
  END IF;

  SELECT m.user_id INTO teacher
    FROM public.account_memberships m
   WHERE m.org_id = org AND m.status = 'active' AND m.user_id <> actor
   ORDER BY m.created_at LIMIT 1;

  -- Fixtures as a table owner (RLS does not apply to the migrator). Disable
  -- the lock trigger only to plant a NULL created_by legacy row.
  INSERT INTO public.academia_classes(id, academia_id, name, position) VALUES (c, acad, 'Policy fixture class', 0);
  INSERT INTO public.academia_subjects(id, class_id, name, position) VALUES (s, c, 'Policy fixture subject', 0);
  INSERT INTO public.academia_subject_teachers(subject_id, teacher_id) VALUES (s, actor);
  IF teacher IS NOT NULL THEN
    INSERT INTO public.academia_subject_teachers(subject_id, teacher_id) VALUES (s, teacher)
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.academia_topics(id, subject_id, name, position, created_by)
    VALUES (t_owner, s, 'Owner topic', 0, actor);
  INSERT INTO public.academia_topics(id, subject_id, name, position, created_by)
    VALUES (t_null, s, 'Legacy topic', 1, actor);
  ALTER TABLE public.academia_topics DISABLE TRIGGER academia_topics_lock_created_by;
  UPDATE public.academia_topics SET created_by = NULL WHERE id = t_null;
  ALTER TABLE public.academia_topics ENABLE TRIGGER academia_topics_lock_created_by;
  IF teacher IS NOT NULL THEN
    INSERT INTO public.academia_topics(id, subject_id, name, position, created_by)
      VALUES (t_teacher, s, 'Teacher topic', 2, teacher);
  END IF;
  INSERT INTO public.academia_subtopics(id, topic_id, name, position, created_by)
    VALUES (u, t_owner, 'Owner subtopic', 0, actor);
  INSERT INTO public.academia_sessions(id, subtopic_id, title, position, created_by)
    VALUES (se, u, 'Owner session', 0, actor);
  INSERT INTO public.academia_activities(id, session_id, kind, ref_id, title, position, tier, created_by)
    VALUES (act_owner, se, 'question', gen_random_uuid(), 'Owner activity', 0, 'beginner', actor);
  IF teacher IS NOT NULL THEN
    INSERT INTO public.academia_activities(id, session_id, kind, ref_id, title, position, tier, created_by)
      VALUES (act_teacher, se, 'question', gen_random_uuid(), 'Teacher activity', 1, 'beginner', teacher);
  END IF;

  -- ---------- authenticated owner ----------
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);

  UPDATE public.academia_topics SET name = 'Owner topic renamed' WHERE id = t_owner;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'owner could not rename their topic'; END IF;
  UPDATE public.academia_topics SET name = 'Legacy topic renamed' WHERE id = t_null;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'owner could not rename a NULL created_by topic'; END IF;
  IF teacher IS NOT NULL THEN
    UPDATE public.academia_topics SET name = 'Teacher topic by owner' WHERE id = t_teacher;
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'owner could not rename a teacher topic'; END IF;
  END IF;
  INSERT INTO public.academia_topics(subject_id, name, position) VALUES (s, 'Owner inserted topic', 9);

  BEGIN
    UPDATE public.academia_topics SET created_by = outsider WHERE id = t_owner;
    RAISE EXCEPTION 'expected created_by lock';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE public.academia_sessions SET title = 'Owner session renamed' WHERE id = se;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'owner could not rename the session'; END IF;
  PERFORM public.academia_reorder_tier(se, 'beginner',
    CASE WHEN teacher IS NULL THEN ARRAY[act_owner] ELSE ARRAY[act_owner, act_teacher] END);

  -- Classes stay owner-writable; a later outsider check confirms teachers cannot.
  UPDATE public.academia_classes SET name = 'Policy fixture class renamed' WHERE id = c;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'owner could not rename the class'; END IF;

  -- ---------- outsider (not a member) ----------
  PERFORM set_config('request.jwt.claim.sub', outsider::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  UPDATE public.academia_topics SET name = 'hacked' WHERE id = t_owner;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'outsider updated a topic'; END IF;
  UPDATE public.academia_classes SET name = 'hacked class' WHERE id = c;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'outsider updated a class'; END IF;
  BEGIN
    INSERT INTO public.academia_topics(subject_id, name, position) VALUES (s, 'outsider topic', 10);
    RAISE EXCEPTION 'outsider inserted a topic';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'outsider inserted%' THEN RAISE; END IF;
  END;

  -- ---------- assigned colleague, when present ----------
  IF teacher IS NULL THEN
    RAISE NOTICE 'No second active school teacher; skipped colleague-teacher cases.';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', teacher::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', teacher, 'role', 'authenticated')::text, true);

    INSERT INTO public.academia_topics(subject_id, name, position) VALUES (s, 'Colleague inserted topic', 11);

    UPDATE public.academia_topics SET name = 'should fail' WHERE id = t_owner;
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'colleague renamed the owner topic'; END IF;
    UPDATE public.academia_topics SET name = 'should fail null' WHERE id = t_null;
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'colleague renamed a NULL created_by topic'; END IF;
    UPDATE public.academia_topics SET name = 'Teacher topic kept' WHERE id = t_teacher;
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'creator could not rename their topic'; END IF;

    UPDATE public.academia_classes SET name = 'hacked by teacher' WHERE id = c;
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'teacher updated a class'; END IF;

    -- Activity they created: allowed. Activity the session owner created: denied.
    UPDATE public.academia_activities SET title = 'Teacher activity renamed' WHERE id = act_teacher;
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'activity creator could not rename their activity'; END IF;
    UPDATE public.academia_activities SET title = 'should fail' WHERE id = act_owner;
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'colleague renamed the session owner activity'; END IF;

    -- Colleague is not the session creator, so reorder is refused.
    BEGIN
      PERFORM public.academia_reorder_tier(se, 'beginner', ARRAY[act_owner, act_teacher]);
      RAISE EXCEPTION 'colleague reordered the session';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE 'colleague reordered%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE 'not_allowed%' THEN RAISE; END IF;
    END;

    -- Session itself is owner-created: colleague cannot rename it.
    UPDATE public.academia_sessions SET title = 'hacked session' WHERE id = se;
    GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'colleague renamed the session'; END IF;
  END IF;

  RAISE NOTICE 'academia_owner_or_creator_write checks passed.';
END $$;
$academia_fixture_body$;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS failure = MESSAGE_TEXT;
    RAISE EXCEPTION '%', failure;
  END;
  RAISE EXCEPTION 'academia_owner_or_creator_write rollback';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'academia_owner_or_creator_write rollback' THEN
    RAISE NOTICE 'academia_owner_or_creator_write rolled back fixtures.';
  ELSE
    RAISE;
  END IF;
END
$academia_fixture_rollback$;
