-- One transaction copies an Academia branch. Learners, attempts and share links
-- are deliberately outside the copy graph. No source record is reused for edits.
CREATE TABLE IF NOT EXISTS private.academia_copy_requests (
  request_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  source_kind text NOT NULL,
  source_id uuid NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.academia_copy_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.academia_copy_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.academia_copy_remap(_value jsonb, _ids jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE v jsonb; k text; result jsonb;
BEGIN
  CASE jsonb_typeof(_value)
    WHEN 'object' THEN
      result := '{}'::jsonb;
      FOR k,v IN SELECT * FROM jsonb_each(_value) LOOP
        result := result || jsonb_build_object(coalesce(_ids->>k,k), private.academia_copy_remap(v,_ids));
      END LOOP;
      RETURN result;
    WHEN 'array' THEN
      SELECT coalesce(jsonb_agg(private.academia_copy_remap(value,_ids) ORDER BY ord),'[]'::jsonb)
      INTO result FROM jsonb_array_elements(_value) WITH ORDINALITY e(value,ord);
      RETURN result;
    WHEN 'string' THEN RETURN coalesce(_ids->(_value #>> '{}'),_value);
    ELSE RETURN _value;
  END CASE;
END $$;
REVOKE ALL ON FUNCTION private.academia_copy_remap(jsonb,jsonb) FROM PUBLIC, anon, authenticated;

-- This private collector accepts only migration-authored table/column names.
CREATE OR REPLACE FUNCTION private.academia_copy_children(_table text, _column text, _parent text)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  EXECUTE format('INSERT INTO pg_temp.academia_copy_graph(table_name,old_id,new_id,payload)
    SELECT %L,t.id,gen_random_uuid(),to_jsonb(t) FROM public.%I t
    JOIN pg_temp.academia_copy_graph p ON p.table_name=%L AND t.%I=p.old_id
    ON CONFLICT(table_name,old_id) DO NOTHING',_table,_table,_parent,_column);
END $$;
REVOKE ALL ON FUNCTION private.academia_copy_children(text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.academia_duplicate_branch(_kind text, _id uuid, _request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public SET statement_timeout = '120s' AS $$
DECLARE
  uid uuid := auth.uid(); root_table text; parent_column text; source jsonb;
  subject_id uuid; org uuid; parent_id uuid; new_root uuid; root_position integer;
  item record; spec record; ids jsonb; data jsonb; outcome jsonb; stored record;
  before_count integer; after_count integer; cols text; code text; code_attempt integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in before duplicating Academia.' USING ERRCODE='42501'; END IF;
  SELECT t,p INTO root_table,parent_column FROM (VALUES
    ('class','academia_classes','academia_id'),('subject','academia_subjects','class_id'),
    ('topic','academia_topics','subject_id'),('subtopic','academia_subtopics','topic_id'),
    ('session','academia_sessions','subtopic_id')) kinds(k,t,p) WHERE k=_kind;
  IF root_table IS NULL OR _request IS NULL THEN RAISE EXCEPTION 'Invalid Academia duplication request.'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',root_table) INTO source USING _id;
  IF source IS NULL THEN RAISE EXCEPTION 'This Academia item no longer exists.'; END IF;
  IF _kind='class' THEN
    SELECT a.org_id INTO org FROM public.academia a WHERE a.id=(source->>'academia_id')::uuid;
  ELSE
    subject_id := CASE _kind WHEN 'subject' THEN _id WHEN 'topic' THEN (source->>'subject_id')::uuid
      WHEN 'subtopic' THEN public.academia_subject_of_subtopic(_id)
      ELSE public.academia_subject_of_session(_id) END;
    org := public.academia_org_of_subject(subject_id);
  END IF;
  IF org IS NULL OR NOT coalesce((public.is_org_owner(org) OR
      (_kind<>'class' AND public.academia_can_build_subject(subject_id))),false) THEN
    RAISE EXCEPTION 'You cannot duplicate this Academia item.' USING ERRCODE='42501';
  END IF;
  -- Serialize retries and duplicate clicks. A different caller cannot reuse a token.
  PERFORM pg_advisory_xact_lock(hashtextextended(_request::text,0));
  SELECT * INTO stored FROM private.academia_copy_requests WHERE request_id=_request;
  IF FOUND THEN
    IF stored.owner_id<>uid OR stored.source_id<>_id OR stored.source_kind<>_kind THEN
      RAISE EXCEPTION 'This copy request belongs to another operation.' USING ERRCODE='42501';
    END IF;
    RETURN stored.result;
  END IF;
  parent_id := (source->>parent_column)::uuid;
  PERFORM pg_advisory_xact_lock(hashtextextended(root_table||':'||parent_id::text,0));
  -- Lock the source branch against concurrent deletion; collect one consistent graph.
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR SHARE',root_table) INTO source USING _id;
  IF source IS NULL THEN RAISE EXCEPTION 'This Academia item no longer exists.'; END IF;
  IF (source->>parent_column)::uuid IS DISTINCT FROM parent_id THEN
    RAISE EXCEPTION 'This item moved while the copy was starting. Try Duplicate again.';
  END IF;
  -- Recheck authority on the locked ancestry, not the earlier UI snapshot.
  -- Lock after the sibling advisory lock so parallel copies cannot deadlock
  -- by each holding a different sibling that the other must renumber.
  CASE _kind
    WHEN 'class' THEN
      SELECT a.org_id INTO org FROM public.academia a WHERE a.id=parent_id FOR SHARE;
    WHEN 'subject' THEN subject_id:=_id;
    WHEN 'topic' THEN subject_id:=(source->>'subject_id')::uuid;
    WHEN 'subtopic' THEN
      SELECT tp.subject_id INTO subject_id FROM public.academia_topics tp WHERE tp.id=parent_id FOR SHARE;
    ELSE
      SELECT tp.subject_id INTO subject_id FROM public.academia_subtopics su JOIN public.academia_topics tp ON tp.id=su.topic_id
        WHERE su.id=parent_id FOR SHARE OF su,tp;
  END CASE;
  IF _kind<>'class' THEN
    SELECT a.org_id INTO org FROM public.academia_subjects s JOIN public.academia_classes c ON c.id=s.class_id
      JOIN public.academia a ON a.id=c.academia_id WHERE s.id=subject_id FOR SHARE OF s,c,a;
  END IF;
  IF org IS NULL OR NOT coalesce((public.is_org_owner(org) OR
      (_kind<>'class' AND public.academia_can_build_subject(subject_id))),false) THEN
    RAISE EXCEPTION 'You cannot duplicate this Academia item.' USING ERRCODE='42501';
  END IF;
  DROP TABLE IF EXISTS pg_temp.academia_copy_graph;
  CREATE TEMP TABLE academia_copy_graph(table_name text NOT NULL,old_id uuid NOT NULL,new_id uuid NOT NULL,
    payload jsonb NOT NULL,PRIMARY KEY(table_name,old_id)) ON COMMIT DROP;
  new_root := gen_random_uuid();
  INSERT INTO pg_temp.academia_copy_graph VALUES(root_table,_id,new_root,source);
  FOR spec IN SELECT * FROM (VALUES
    ('academia_subjects','class_id','academia_classes'),('academia_topics','subject_id','academia_subjects'),
    ('academia_subtopics','topic_id','academia_topics'),('academia_sessions','subtopic_id','academia_subtopics'),
    ('academia_activities','session_id','academia_sessions'),('academia_mcq_items','activity_id','academia_activities'),
    ('academia_adventure_questions','activity_id','academia_activities'),
    ('academia_mcq_papers','subject_id','academia_subjects')) s(t,c,p)
  LOOP PERFORM private.academia_copy_children(spec.t,spec.c,spec.p); END LOOP;

  -- Reachable content only. New copies never use the original editable object.
  LOOP
    SELECT count(*) INTO before_count FROM pg_temp.academia_copy_graph;
    INSERT INTO pg_temp.academia_copy_graph
      SELECT 'assessments',t.id,gen_random_uuid(),to_jsonb(t) FROM public.assessments t
      WHERE t.id IN (SELECT (payload->>'assessment_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name IN ('academia_activities','class_game_boards'))
      ON CONFLICT DO NOTHING;
    INSERT INTO pg_temp.academia_copy_graph
      SELECT 'slate_games',t.id,gen_random_uuid(),to_jsonb(t) FROM public.slate_games t
      WHERE t.id IN (SELECT (payload->>'game_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name='academia_activities')
        OR t.id IN (SELECT (payload->>'ref_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name='academia_activities' AND payload->>'kind'='game')
      ON CONFLICT DO NOTHING;
    INSERT INTO pg_temp.academia_copy_graph
      SELECT 'games',t.id,gen_random_uuid(),to_jsonb(t) FROM public.games t
      WHERE t.id IN (SELECT (payload->>'ref_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name='academia_activities' AND payload->>'kind' IN ('adventure','game'))
      ON CONFLICT DO NOTHING;
    INSERT INTO pg_temp.academia_copy_graph
      SELECT 'academia_mcq_papers',t.id,gen_random_uuid(),to_jsonb(t) FROM public.academia_mcq_papers t
      WHERE t.id IN (SELECT (payload->>'ref_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name='academia_activities' AND payload->>'kind'='mcq')
      ON CONFLICT DO NOTHING;
    INSERT INTO pg_temp.academia_copy_graph
      SELECT 'classes',t.id,gen_random_uuid(),to_jsonb(t) FROM public.classes t
      WHERE t.id IN (SELECT (payload->>'class_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name IN ('academia_activities','assessments'))
      ON CONFLICT DO NOTHING;
    -- Game questions are scoped to the copied hidden classes, or the author's
    -- unassigned question list. Do not collect other classes' assignments.
    INSERT INTO pg_temp.academia_copy_graph
      SELECT 'slate_game_questions',t.id,gen_random_uuid(),to_jsonb(t) FROM public.slate_game_questions t
      JOIN pg_temp.academia_copy_graph g ON g.table_name='slate_games' AND g.old_id=t.game_id
      WHERE t.class_id IS NULL OR t.class_id IN (SELECT old_id FROM pg_temp.academia_copy_graph WHERE table_name='classes')
      ON CONFLICT DO NOTHING;
    FOR spec IN SELECT * FROM (VALUES
      ('class_adventures','game_id','games'),('class_games','game_id','games'),('class_game_boards','game_id','games'),
      ('adventure_bar_questions','game_id','games'),('slate_game_assignments','game_id','slate_games')) s(t,c,p)
    LOOP
      EXECUTE format('INSERT INTO pg_temp.academia_copy_graph
        SELECT %L,t.id,gen_random_uuid(),to_jsonb(t) FROM public.%I t
        JOIN pg_temp.academia_copy_graph g ON g.table_name=%L AND g.old_id=t.%I
        WHERE t.class_id IN (SELECT old_id FROM pg_temp.academia_copy_graph WHERE table_name=''classes'')
        AND EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph a WHERE a.table_name=''academia_activities''
          AND (a.payload->>''class_id'')::uuid=t.class_id AND
          ((a.payload->>''game_id'')::uuid=t.game_id OR (a.payload->>''ref_id'')::uuid=t.game_id))
        AND (to_jsonb(t)->>''unassigned_at'' IS NULL) AND (to_jsonb(t)->>''unlinked_at'' IS NULL)
        ON CONFLICT DO NOTHING',spec.t,spec.t,spec.p,spec.c);
    END LOOP;
    INSERT INTO pg_temp.academia_copy_graph
      SELECT 'notebooks',t.id,gen_random_uuid(),to_jsonb(t) FROM public.notebooks t
      WHERE t.id IN (SELECT (payload->>'lesson_note_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name='academia_sessions')
        OR t.id IN (SELECT (payload->>'ref_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name='academia_activities' AND payload->>'kind' IN ('question','smartboard','lesson_note'))
        OR t.id IN (SELECT (payload->>'notebook_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name IN ('assessments','slate_game_questions','academia_adventure_questions','adventure_bar_questions','class_game_boards'))
        OR t.id IN (SELECT (payload->>'source_notebook_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name='academia_mcq_papers')
      ON CONFLICT DO NOTHING;
    INSERT INTO pg_temp.academia_copy_graph
      SELECT 'flows',t.id,gen_random_uuid(),to_jsonb(t) FROM public.flows t
      WHERE t.id IN (SELECT (payload->>'flow_id')::uuid FROM pg_temp.academia_copy_graph WHERE table_name='notebooks')
      ON CONFLICT DO NOTHING;
    SELECT count(*) INTO after_count FROM pg_temp.academia_copy_graph;
    EXIT WHEN before_count=after_count;
  END LOOP;
  INSERT INTO pg_temp.academia_copy_graph
    SELECT 'class_adventure_notes',t.id,gen_random_uuid(),to_jsonb(t) FROM public.class_adventure_notes t
    WHERE t.class_id IN (SELECT old_id FROM pg_temp.academia_copy_graph WHERE table_name='classes')
      AND t.notebook_id IN (SELECT old_id FROM pg_temp.academia_copy_graph WHERE table_name='notebooks')
      AND t.unassigned_at IS NULL ON CONFLICT DO NOTHING;
  FOR spec IN SELECT * FROM (VALUES
    ('notebook_subtopics','notebook_id','notebooks'),('notebook_sections','notebook_id','notebooks'),
    ('notebook_subsections','section_id','notebook_sections'),('notebook_blocks','section_id','notebook_sections'),
    ('notebook_slide_decks','notebook_id','notebooks'),('notebook_slides','notebook_id','notebooks'),
    ('notebook_slide_items','slide_id','notebook_slides')) s(t,c,p)
  LOOP PERFORM private.academia_copy_children(spec.t,spec.c,spec.p); END LOOP;

  -- A malformed/cross-workspace reference must never turn this RPC into a
  -- privileged reader of someone else's private notebook or Game.
  IF EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph g WHERE table_name='notebooks' AND NOT coalesce((
    (payload->>'owner_id')::uuid=uid OR ((payload->>'org_id')::uuid=org AND public.is_org_owner(org))
    OR private.notebook_shared_to_member(old_id) OR public.is_community_published('lesson_note',old_id)),false)) THEN
    RAISE EXCEPTION 'A linked lesson note is private. Share it with the school before duplicating.' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph g WHERE table_name='classes' AND
    (payload->>'workspace' IS DISTINCT FROM 'academia' OR NOT coalesce(((payload->>'owner_id')::uuid=uid
      OR ((payload->>'org_id')::uuid=org AND public.is_org_owner(org)) OR EXISTS(
      SELECT 1 FROM public.organizations o WHERE o.id=org AND o.owner_user_id=(g.payload->>'owner_id')::uuid)
      OR EXISTS(SELECT 1 FROM public.account_memberships m WHERE m.org_id=org AND m.user_id=(g.payload->>'owner_id')::uuid AND m.status='active')),false))) THEN
    RAISE EXCEPTION 'A linked question class is outside this school.' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph g WHERE table_name IN ('games','slate_games') AND NOT coalesce((
    (payload->>'owner_id')::uuid=uid OR (table_name='games' AND (payload->>'org_id')::uuid=org AND public.is_org_owner(org))
    OR EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph a WHERE a.table_name IN ('class_adventures','class_games','class_game_boards','slate_game_assignments') AND (a.payload->>'game_id')::uuid=g.old_id)),false)) THEN
    RAISE EXCEPTION 'A linked Game is private. Assign it to this Academia before duplicating.' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph g WHERE table_name='flows' AND NOT coalesce((
    (payload->>'owner_id')::uuid=uid OR (payload->>'scope'='mathgpl' AND payload->>'status'='published')),false)) THEN
    RAISE EXCEPTION 'A linked Flow is private.' USING ERRCODE='42501';
  END IF;
  -- Validate every content reference instead of leaving silently shared/broken
  -- references behind when the original object has been deleted.
  FOR item IN SELECT * FROM pg_temp.academia_copy_graph WHERE table_name='academia_activities' LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph g WHERE g.old_id=(item.payload->>'ref_id')::uuid
      AND g.table_name=CASE item.payload->>'kind' WHEN 'mcq' THEN 'academia_mcq_papers' WHEN 'adventure' THEN 'games'
        WHEN 'game' THEN CASE WHEN EXISTS(SELECT 1 FROM public.slate_games WHERE id=(item.payload->>'ref_id')::uuid) THEN 'slate_games' ELSE 'games' END
        ELSE 'notebooks' END) THEN RAISE EXCEPTION 'An activity source is missing; no duplicate was created.'; END IF;
    IF item.payload->>'assessment_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph WHERE table_name='assessments' AND old_id=(item.payload->>'assessment_id')::uuid) THEN
      RAISE EXCEPTION 'An activity assessment is missing; no duplicate was created.';
    END IF;
    IF item.payload->>'game_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph WHERE table_name='slate_games' AND old_id=(item.payload->>'game_id')::uuid) THEN
      RAISE EXCEPTION 'An activity Game is missing; no duplicate was created.';
    END IF;
    IF item.payload->>'class_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_temp.academia_copy_graph WHERE table_name='classes' AND old_id=(item.payload->>'class_id')::uuid) THEN
      RAISE EXCEPTION 'An activity question class is missing; no duplicate was created.';
    END IF;
  END LOOP;
  IF EXISTS(SELECT old_id FROM pg_temp.academia_copy_graph GROUP BY old_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Ambiguous content identities prevent a safe independent copy.';
  END IF;
  SELECT jsonb_object_agg(old_id::text,to_jsonb(new_id::text)) INTO ids FROM pg_temp.academia_copy_graph;
  -- Prepared question identities have global unique indexes, not just a
  -- per-notebook scope. Rekey them and all JSON references together.
  FOR item IN SELECT * FROM pg_temp.academia_copy_graph
    WHERE table_name IN ('notebook_sections','notebook_subsections') AND payload->>'stable_key' IS NOT NULL
  LOOP
    IF ids ? (item.payload->>'stable_key') AND ids->>(item.payload->>'stable_key')<>item.new_id::text THEN
      RAISE EXCEPTION 'Ambiguous prepared-question identity prevents a safe copy.';
    END IF;
    ids := ids || jsonb_build_object(item.payload->>'stable_key',item.new_id::text);
  END LOOP;
  -- Insert immediately below the source. Sibling renumbering is serialized.
  EXECUTE format('SELECT count(*) FROM public.%I t WHERE t.%I=$1 AND
    (t.position,t.created_at,t.id) <= ($2,$3,$4)',root_table,parent_column)
    INTO root_position USING parent_id,(source->>'position')::integer,(source->>'created_at')::timestamptz,_id;
  EXECUTE format('WITH ranked AS (SELECT id,row_number() OVER(ORDER BY position,created_at,id)-1 AS p FROM public.%I WHERE %I=$1)
    UPDATE public.%I t SET position=CASE WHEN r.p >= $2 THEN r.p+1 ELSE r.p END FROM ranked r WHERE t.id=r.id',root_table,parent_column,root_table)
    USING parent_id,root_position;
  FOR spec IN SELECT * FROM (VALUES
    (1,'flows'),(2,'classes'),(3,'notebooks'),(4,'notebook_subtopics'),(5,'notebook_sections'),
    (6,'notebook_subsections'),(7,'notebook_blocks'),(8,'notebook_slide_decks'),(9,'notebook_slides'),(10,'notebook_slide_items'),
    (11,'assessments'),(12,'games'),(13,'slate_games'),(14,'slate_game_questions'),
    (15,'academia_classes'),(16,'academia_subjects'),(17,'academia_topics'),(18,'academia_subtopics'),
    (19,'academia_sessions'),(20,'academia_mcq_papers'),(21,'academia_activities'),(22,'academia_mcq_items'),
    (23,'academia_adventure_questions'),(24,'class_adventures'),(25,'class_game_boards'),
    (26,'adventure_bar_questions'),(27,'slate_game_assignments'),(28,'class_games'),(29,'class_adventure_notes')) ordered(n,t) ORDER BY n
  LOOP
    SELECT string_agg(format('%I',a.attname),',' ORDER BY a.attnum) INTO cols
      FROM pg_attribute a WHERE a.attrelid=format('public.%I',spec.t)::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated='';
    FOR item IN SELECT * FROM pg_temp.academia_copy_graph WHERE table_name=spec.t ORDER BY old_id LOOP
      data := private.academia_copy_remap(item.payload,ids) || jsonb_build_object('id',item.new_id);
      IF data ? 'created_at' THEN data := data || jsonb_build_object('created_at',now()); END IF;
      IF data ? 'updated_at' THEN data := data || jsonb_build_object('updated_at',now()); END IF;
      IF data ? 'owner_id' THEN data := data || jsonb_build_object('owner_id',uid); END IF;
      IF data ? 'org_id' THEN data := data || jsonb_build_object('org_id',org); END IF;
      IF data ? 'created_by' THEN data := data || jsonb_build_object('created_by',uid); END IF;
      IF data ? 'assigned_by' THEN data := data || jsonb_build_object('assigned_by',uid); END IF;
      IF data ? 'linked_by' THEN data := data || jsonb_build_object('linked_by',uid); END IF;
      IF item.table_name=root_table AND item.old_id=_id THEN
        data := data || jsonb_build_object(CASE WHEN _kind='session' THEN 'title' ELSE 'name' END,
          coalesce(source->>CASE WHEN _kind='session' THEN 'title' ELSE 'name' END,'Untitled')||' duplicate','position',root_position);
      END IF;
      IF item.table_name='classes' THEN
        code_attempt := 0;
        LOOP
          code := 'AC'||upper(substr(md5(item.new_id::text||':'||code_attempt::text),1,6));
          EXIT WHEN NOT EXISTS(SELECT 1 FROM public.classes WHERE class_code=code);
          code_attempt := code_attempt+1;
          IF code_attempt>20 THEN RAISE EXCEPTION 'Could not allocate a fresh Academia class code.'; END IF;
        END LOOP;
        data := data || jsonb_build_object('class_code',code,'community_shared',false,'broadcasts','[]'::jsonb);
      ELSIF item.table_name='notebooks' THEN
        data := data || jsonb_build_object('origin_notebook_id',NULL,'checkout_link_id',NULL,'storage_scope','class','archived_at',NULL);
        IF data->>'active_subtopic_id' IS NOT NULL AND NOT ids ? (item.payload->>'active_subtopic_id') THEN
          data := data || jsonb_build_object('active_subtopic_id',NULL);
        END IF;
      ELSIF item.table_name='flows' THEN
        data := data || jsonb_build_object('scope','personal','status','draft','source_flow_id',NULL);
      ELSIF item.table_name='academia_activities' THEN
        data := data || jsonb_build_object('link_code',NULL,'game_link_code',NULL);
      ELSIF item.table_name IN ('assessments','class_game_boards','class_adventure_notes') THEN
        data := data || jsonb_build_object('assignment_id',NULL);
      ELSIF item.table_name='academia_mcq_papers' AND item.payload->>'source_notebook_id' IS NOT NULL
          AND NOT ids ? (item.payload->>'source_notebook_id') THEN
        data := data || jsonb_build_object('source_notebook_id',NULL);
      ELSIF item.table_name='slate_games' THEN
        data := data || jsonb_build_object('status',jsonb_build_object('vaultsOpened',0,'lives',3,'timerEndsAt',NULL));
      ELSIF item.table_name='class_games' THEN
        data := data || jsonb_build_object('winner_group_id',NULL);
      END IF;
      EXECUTE format('INSERT INTO public.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1)',spec.t,cols,cols,spec.t) USING data;
    END LOOP;
  END LOOP;
  INSERT INTO public.academia_subject_teachers(subject_id,teacher_id)
    SELECT g.new_id,t.teacher_id FROM public.academia_subject_teachers t JOIN pg_temp.academia_copy_graph g
      ON g.table_name='academia_subjects' AND g.old_id=t.subject_id;
  INSERT INTO public.academia_adventure_points(activity_id,scene_id,pass_pct)
    SELECT g.new_id,p.scene_id,p.pass_pct FROM public.academia_adventure_points p JOIN pg_temp.academia_copy_graph g
      ON g.table_name='academia_activities' AND g.old_id=p.activity_id;
  SELECT jsonb_build_object('id',new_root,'kind',_kind,'name',coalesce(source->>'name',source->>'title')||' duplicate',
    'counts',(SELECT jsonb_object_agg(table_name,n) FROM (SELECT table_name,count(*) n FROM pg_temp.academia_copy_graph GROUP BY table_name) c)) INTO outcome;
  INSERT INTO private.academia_copy_requests(request_id,owner_id,source_kind,source_id,result) VALUES(_request,uid,_kind,_id,outcome);
  RETURN outcome;
END $$;
REVOKE ALL ON FUNCTION public.academia_duplicate_branch(text,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_duplicate_branch(text,uuid,uuid) TO authenticated;
