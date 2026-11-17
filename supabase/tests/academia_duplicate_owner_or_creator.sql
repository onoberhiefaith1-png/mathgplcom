-- Policy checks for 20261117180000_academia_duplicate_owner_or_creator.sql.
-- Requires a school Academia (same fixture rule as academia_deep_duplicate.sql).
-- This file never commits fixture data: the wrapper always rolls back.
--
-- How to run (after Lovable or supabase db has applied the migration):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/academia_duplicate_owner_or_creator.sql
--
--  1. School owner can duplicate class, subject, topic, subtopic and session.
--  2. The creating teacher can duplicate their own topic / subtopic / session.
--  3. An assigned teacher who did not create the item cannot duplicate it.
--  4. Teachers cannot duplicate a class or subject (owner-only).
--  5. A topic with created_by IS NULL is owner-only for duplicate.

DO $academia_fixture_rollback$
DECLARE failure text;
BEGIN
  BEGIN
    EXECUTE $academia_fixture_body$
DO $$
DECLARE
  actor uuid; acad uuid; org uuid; teacher uuid;
  c uuid := gen_random_uuid(); s uuid := gen_random_uuid();
  t_owner uuid := gen_random_uuid(); t_teacher uuid := gen_random_uuid(); t_null uuid := gen_random_uuid();
  u_teacher uuid := gen_random_uuid(); se_teacher uuid := gen_random_uuid();
  response jsonb;
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

  INSERT INTO public.academia_classes(id, academia_id, name, position) VALUES (c, acad, 'Duplicate fixture class', 0);
  INSERT INTO public.academia_subjects(id, class_id, name, position) VALUES (s, c, 'Duplicate fixture subject', 0);
  INSERT INTO public.academia_subject_teachers(subject_id, teacher_id) VALUES (s, actor);
  IF teacher IS NOT NULL THEN
    INSERT INTO public.academia_subject_teachers(subject_id, teacher_id) VALUES (s, teacher) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.academia_topics(id, subject_id, name, position, created_by)
    VALUES (t_owner, s, 'Owner topic', 0, actor);
  INSERT INTO public.academia_topics(id, subject_id, name, position, created_by)
    VALUES (t_null, s, 'Legacy topic', 1, actor);
  ALTER TABLE public.academia_topics DISABLE TRIGGER academia_topics_lock_created_by;
  UPDATE public.academia_topics SET created_by = NULL WHERE id = t_null;
  ALTER TABLE public.academia_topics ENABLE TRIGGER academia_topics_lock_created_by;

  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  response := public.academia_duplicate_branch('class', c, gen_random_uuid());
  ASSERT (response->>'id')::uuid <> c, 'owner can duplicate a class';
  response := public.academia_duplicate_branch('subject', s, gen_random_uuid());
  ASSERT (response->>'id')::uuid <> s, 'owner can duplicate a subject';
  response := public.academia_duplicate_branch('topic', t_owner, gen_random_uuid());
  ASSERT (response->>'id')::uuid <> t_owner, 'owner can duplicate a topic they did not need to create';
  response := public.academia_duplicate_branch('topic', t_null, gen_random_uuid());
  ASSERT (response->>'id')::uuid <> t_null, 'owner can duplicate a legacy topic with no creator';

  IF teacher IS NOT NULL THEN
    INSERT INTO public.academia_topics(id, subject_id, name, position, created_by)
      VALUES (t_teacher, s, 'Teacher topic', 2, teacher);
    INSERT INTO public.academia_subtopics(id, topic_id, name, position, created_by)
      VALUES (u_teacher, t_teacher, 'Teacher subtopic', 0, teacher);
    INSERT INTO public.academia_sessions(id, subtopic_id, title, position, created_by)
      VALUES (se_teacher, u_teacher, 'Teacher session', 0, teacher);

    PERFORM set_config('request.jwt.claim.sub', teacher::text, true);

    response := public.academia_duplicate_branch('topic', t_teacher, gen_random_uuid());
    ASSERT (response->>'id')::uuid <> t_teacher, 'creator can duplicate their topic';
    response := public.academia_duplicate_branch('subtopic', u_teacher, gen_random_uuid());
    ASSERT (response->>'id')::uuid <> u_teacher, 'creator can duplicate their subtopic';
    response := public.academia_duplicate_branch('session', se_teacher, gen_random_uuid());
    ASSERT (response->>'id')::uuid <> se_teacher, 'creator can duplicate their session';

    BEGIN
      PERFORM public.academia_duplicate_branch('topic', t_owner, gen_random_uuid());
      RAISE EXCEPTION 'Expected assigned teacher to be refused on another teacher''s topic';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM public.academia_duplicate_branch('topic', t_null, gen_random_uuid());
      RAISE EXCEPTION 'Expected assigned teacher to be refused on a legacy topic';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM public.academia_duplicate_branch('class', c, gen_random_uuid());
      RAISE EXCEPTION 'Expected teacher class-copy failure';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM public.academia_duplicate_branch('subject', s, gen_random_uuid());
      RAISE EXCEPTION 'Expected teacher subject-copy failure';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  ELSE
    RAISE NOTICE 'No second teacher on this school; teacher duplicate cases were skipped.';
  END IF;
END $$;
$academia_fixture_body$;
    RAISE EXCEPTION 'All Academia duplicate-permission fixtures passed' USING ERRCODE='ZX001';
  EXCEPTION
    WHEN SQLSTATE 'ZX001' THEN NULL;
    WHEN OTHERS THEN failure:=SQLSTATE||': '||SQLERRM;
  END;
  IF failure IS NOT NULL THEN RAISE EXCEPTION 'Academia duplicate-permission validation failed: %',failure; END IF;
END $academia_fixture_rollback$;
