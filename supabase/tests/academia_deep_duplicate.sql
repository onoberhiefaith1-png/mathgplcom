-- Requires the staged migration. This file never commits fixture data.
DO $academia_fixture_rollback$
DECLARE failure text;
BEGIN
  BEGIN
    EXECUTE $academia_fixture_body$
-- Run after the migration. The wrapper always rolls back fixtures, even standalone.
DO $$
DECLARE
  actor uuid; acad uuid; org uuid; outsider uuid; teacher uuid;
  c uuid:=gen_random_uuid(); peer uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid();
  t uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid();
  se uuid:=gen_random_uuid(); se2 uuid:=gen_random_uuid(); hidden uuid:=gen_random_uuid();
  nb uuid:=gen_random_uuid(); sec uuid:=gen_random_uuid(); flow uuid:=gen_random_uuid();
  deck uuid:=gen_random_uuid(); slide uuid:=gen_random_uuid(); paper uuid:=gen_random_uuid();
  game uuid:=gen_random_uuid(); video uuid:=gen_random_uuid(); adventure uuid:=gen_random_uuid(); mcq uuid:=gen_random_uuid();
  sub uuid; assessment uuid; act uuid; first_sub uuid; first_assessment uuid; first_act uuid;
  response jsonb; replay jsonb; request uuid:=gen_random_uuid(); copied uuid; new_subject uuid; new_session uuid; new_note uuid; new_activity uuid;
  before_rows integer; after_rows integer; copy_position integer; n integer; source_hash text; helper text; kind text; target uuid;
BEGIN
  SELECT a.id,a.org_id,o.owner_user_id INTO acad,org,actor FROM public.academia a JOIN public.organizations o ON o.id=a.org_id WHERE o.kind='school' LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'An existing school Academia is required for rollback-only validation.'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  INSERT INTO public.academia_classes(id,academia_id,name,position) VALUES(c,acad,'Rollback fixture class',0),(peer,acad,'Rollback fixture peer',1);
  INSERT INTO public.academia_subjects(id,class_id,name,position) VALUES(s,c,'Mathematics',0),(s2,c,'Empty subject',1);
  INSERT INTO public.academia_subject_teachers(subject_id,teacher_id) VALUES(s,actor),(s2,actor);
  INSERT INTO public.academia_topics(id,subject_id,name,position) VALUES(t,s,'Algebra',0);
  INSERT INTO public.academia_subtopics(id,topic_id,name,position) VALUES(u,t,'Equations',0),(u2,t,'Revision',1);
  INSERT INTO public.flows(id,owner_id,name,scope,status,clips,scenes,trail,position) VALUES(flow,actor,'Fixture flow','personal','draft','[]','[]','[]','{}');
  INSERT INTO public.notebooks(id,owner_id,org_id,title,flow_id,flow_enabled,document_json,companion_json)
    VALUES(nb,actor,org,'Fixture source note',flow,true,jsonb_build_object('type','doc','sourceNotebookId',nb),'{"fixture":true}');
  -- Use the database's real enum, never assume a generated enum label.
  SELECT e.enumlabel INTO kind FROM pg_attribute a JOIN pg_enum e ON e.enumtypid=a.atttypid
    WHERE a.attrelid='public.notebook_sections'::regclass AND a.attname='kind' ORDER BY e.enumsortorder LIMIT 1;
  INSERT INTO public.notebook_sections SELECT (jsonb_populate_record(NULL::public.notebook_sections,
    jsonb_build_object('id',sec,'notebook_id',nb,'kind',kind,'title','Examples','order_index',0,
      'created_at',now(),'stable_key',gen_random_uuid()))).*;
  INSERT INTO public.notebook_subtopics(notebook_id,name,document_json) VALUES(nb,'Saved subtopic','{"type":"doc"}');
  INSERT INTO public.notebook_slide_decks(id,notebook_id,name) VALUES(deck,nb,'Fixture deck');
  INSERT INTO public.notebook_slides(id,notebook_id,deck_id,name) VALUES(slide,nb,deck,'Fixture slide');
  INSERT INTO public.notebook_slide_items(slide_id,kind,storage_path,content_json)
    VALUES(slide,'image','fixture/immutable.png',jsonb_build_object('notebookId',nb));
  INSERT INTO public.classes(id,class_code,name,owner_id,workspace) VALUES(hidden,'AC'||upper(substr(replace(hidden::text,'-',''),1,6)),'Academia',actor,'academia');
  INSERT INTO public.class_members(class_id,user_id) VALUES(hidden,actor);
  INSERT INTO public.academia_sessions(id,subtopic_id,title,position,lesson_note_id,video_url,intermediate_video_url,expert_video_url)
    VALUES(se,u,'Introduction',0,nb,'beginner.mp4','intermediate.mp4','expert.mp4'),(se2,u2,'Revision session',0,nb,NULL,NULL,NULL);
  INSERT INTO public.slate_games(id,owner_id,name,surface_id,room_id,settings,status) VALUES(game,actor,'Fixture Game','fixture-surface','fixture-room','{"lines":{"L1":{"fixture":true}}}','{"vaultsOpened":8,"lives":1,"timerEndsAt":123}');
  INSERT INTO public.games(id,owner_id,org_id,title,canvas) VALUES(video,actor,org,'Fixture Adventure','{"scenes":[{"id":"loop-1","duration":10}]}');
  FOR n IN 1..300 LOOP
    sub:=gen_random_uuid();assessment:=gen_random_uuid();act:=gen_random_uuid();
    IF n=1 THEN first_sub:=sub;first_assessment:=assessment;first_act:=act;END IF;
    INSERT INTO public.notebook_subsections(id,section_id,order_index,floating_lines,floating_bucket,stable_key)
      VALUES(sub,sec,n,jsonb_build_array(jsonb_build_object('equation','x='||n,'note','Compare with the standard form')),jsonb_build_object('notebookId',nb),gen_random_uuid());
    INSERT INTO public.assessments(id,class_id,owner_id,notebook_id,section_id,title,total_marks,questions)
      VALUES(assessment,hidden,actor,nb,sec,'Question '||n,10,jsonb_build_array(jsonb_build_object('id',sub,'question','x='||n,'subsectionId',sub,'notebookId',nb,'lines',jsonb_build_array('x='||n))));
    INSERT INTO public.academia_activities(id,session_id,kind,ref_id,title,position,class_id,assessment_id,game_id,subsection_id,tier,practice_video,play_video,audio,link_code,game_link_code)
      VALUES(act,se,'question',nb,'Question '||n,n,hidden,assessment,game,sub,
        CASE n%3 WHEN 0 THEN 'expert' WHEN 1 THEN 'beginner' ELSE 'intermediate' END,
        '{"fixture":"practice"}','{"fixture":"play"}','{"fixture":"narration"}','SOURCE-PRACTICE','SOURCE-PLAY');
  END LOOP;
  SELECT e.enumlabel INTO kind FROM pg_attribute a JOIN pg_enum e ON e.enumtypid=a.atttypid
    WHERE a.attrelid='public.notebook_blocks'::regclass AND a.attname='kind' ORDER BY e.enumsortorder LIMIT 1;
  INSERT INTO public.notebook_blocks SELECT (jsonb_populate_record(NULL::public.notebook_blocks,
    jsonb_build_object('id',gen_random_uuid(),'section_id',sec,'subsection_id',first_sub,'kind',kind,
      'content_ascii','2x + 1 = 3','content_json',jsonb_build_object('subsectionId',first_sub),
      'order_index',0,'created_at',now(),'updated_at',now()))).*;
  UPDATE public.notebooks SET document_json=document_json||jsonb_build_object('questionStableKey',
    (SELECT stable_key FROM public.notebook_subsections WHERE id=first_sub)) WHERE id=nb;
  INSERT INTO public.slate_game_questions(game_id,class_id,notebook_id,subsection_id) VALUES(game,hidden,nb,first_sub);
  INSERT INTO public.slate_game_assignments(game_id,class_id,created_by,pass_percentage) VALUES(game,hidden,actor,100);
  INSERT INTO public.academia_mcq_papers(id,subject_id,source_notebook_id,title,questions,created_by)
    VALUES(paper,s,nb,'Fixture MCQ','[{"n":1,"text":"1+1?","options":[{"label":"A","text":"2"}],"answer":"A"}]',actor);
  INSERT INTO public.academia_activities(id,session_id,kind,ref_id,title,position,tier)
    VALUES(mcq,se,'mcq',paper,'Fixture MCQ',301,'intermediate');
  INSERT INTO public.academia_mcq_items(activity_id,n,text,options,answer) VALUES(mcq,1,'1+1?','[{"label":"A","text":"2"}]','A');
  INSERT INTO public.academia_activities(id,session_id,kind,ref_id,title,position,class_id,game_id,tier,audio)
    VALUES(adventure,se,'adventure',video,'Fixture Adventure',302,hidden,game,'expert','{"repeat":false}');
  INSERT INTO public.academia_adventure_points(activity_id,scene_id,pass_pct) VALUES(adventure,'loop-1',80);
  INSERT INTO public.academia_adventure_questions(activity_id,scene_id,bar_id,title,question_text,lines,total_marks,notebook_id,subsection_id)
    VALUES(adventure,'loop-1','bar-1','Adventure question','x=1','[{"equation":"x=1"}]',10,nb,first_sub);
  INSERT INTO public.class_adventures(class_id,game_id,linked_by) VALUES(hidden,video,actor);
  INSERT INTO public.class_game_boards(class_id,game_id,progress_element_id,assessment_id,notebook_id,section_id,required_marks)
    VALUES(hidden,video,'bar-1',first_assessment,nb,sec,10);
  INSERT INTO public.adventure_bar_questions(class_id,game_id,progress_element_id,notebook_id,section_id,assigned_by)
    VALUES(hidden,video,'bar-1',nb,sec,actor);
  INSERT INTO public.class_adventure_notes(class_id,notebook_id,section_id,assigned_by) VALUES(hidden,nb,sec,actor);
  INSERT INTO public.academia_attempts(session_id,activity_id,user_id,mode,score,max_score,best_score,status)
    VALUES(se,first_act,actor,'practice',10,10,10,'completed');
  INSERT INTO public.academia_mcq_attempts(paper_id,user_id,answers,correct,total) VALUES(paper,actor,'{"1":"A"}',1,1);
  SELECT md5(to_jsonb(q)::text) INTO source_hash FROM public.notebooks q WHERE id=nb;
  response:=public.academia_duplicate_branch('class',c,request);copied:=(response->>'id')::uuid;
  ASSERT copied<>c, 'fresh root identity';
  ASSERT (SELECT name FROM public.academia_classes WHERE id=copied)='Rollback fixture class duplicate','root naming';
  ASSERT (SELECT position FROM public.academia_classes WHERE id=copied)=(SELECT position+1 FROM public.academia_classes WHERE id=c),'copy immediately follows source';
  ASSERT (SELECT count(*) FROM public.academia_subjects WHERE class_id=copied)=2,'all subjects, including empty ones';
  SELECT id INTO new_subject FROM public.academia_subjects WHERE class_id=copied AND name='Mathematics';
  SELECT es.id,es.lesson_note_id INTO new_session,new_note FROM public.academia_sessions es JOIN public.academia_subtopics su ON su.id=es.subtopic_id
    JOIN public.academia_topics tp ON tp.id=su.topic_id WHERE tp.subject_id=new_subject AND es.title='Introduction';
  ASSERT new_session<>se AND new_note<>nb,'session and notebook independence';
  ASSERT (SELECT count(*) FROM public.academia_activities WHERE session_id=new_session)=302,'all 300 questions and both special activities';
  ASSERT (SELECT count(*) FROM public.notebook_subsections ss JOIN public.notebook_sections ns ON ns.id=ss.section_id WHERE ns.notebook_id=new_note)=300,'all floating-number preparations';
  ASSERT EXISTS(SELECT 1 FROM public.notebooks n JOIN public.notebook_sections ns ON ns.notebook_id=n.id
    JOIN public.notebook_subsections ss ON ss.section_id=ns.id WHERE n.id=new_note AND ss.stable_key::text=n.document_json->>'questionStableKey'),'prepared identities remapped consistently';
  ASSERT (SELECT b.content_ascii FROM public.notebook_blocks b JOIN public.notebook_sections ns ON ns.id=b.section_id WHERE ns.notebook_id=new_note)='2x + 1 = 3','mathematics unchanged';
  ASSERT EXISTS(SELECT 1 FROM public.notebook_blocks b JOIN public.notebook_sections ns ON ns.id=b.section_id
    WHERE ns.notebook_id=new_note AND b.content_json->>'subsectionId'=b.subsection_id::text),'block references remapped';
  ASSERT (SELECT count(*) FROM public.notebook_slide_items i JOIN public.notebook_slides sl ON sl.id=i.slide_id WHERE sl.notebook_id=new_note)=1,'slide assets copied';
  ASSERT (SELECT companion_json FROM public.notebooks WHERE id=new_note)='{"fixture":true}'::jsonb,'new optional notebook content retained';
  ASSERT (SELECT (document_json->>'sourceNotebookId')::uuid FROM public.notebooks WHERE id=new_note)=new_note,'nested JSON reference remapped';
  ASSERT (SELECT flow_id FROM public.notebooks WHERE id=new_note)<>flow,'Flow copied';
  ASSERT (SELECT intermediate_video_url||':'||expert_video_url FROM public.academia_sessions WHERE id=new_session)='intermediate.mp4:expert.mp4','all tier videos';
  ASSERT NOT EXISTS(SELECT 1 FROM public.academia_activities WHERE session_id=new_session AND (link_code IS NOT NULL OR game_link_code IS NOT NULL)),'fresh links';
  ASSERT NOT EXISTS(SELECT 1 FROM public.academia_attempts WHERE session_id=new_session),'no copied attempts';
  ASSERT NOT EXISTS(SELECT 1 FROM public.academia_activities a JOIN public.assessments ass ON ass.id=a.assessment_id
    WHERE a.session_id=new_session AND (ass.id=first_assessment OR ass.notebook_id=nb OR ass.class_id=hidden)),'fresh evaluation sources';
  ASSERT NOT EXISTS(SELECT 1 FROM public.class_members m JOIN public.academia_activities a ON a.class_id=m.class_id WHERE a.session_id=new_session),'no copied class memberships';
  ASSERT (SELECT count(*) FROM public.academia_activities WHERE session_id=new_session AND tier='beginner')=100,'beginner batch';
  ASSERT (SELECT count(*) FROM public.academia_activities WHERE session_id=new_session AND tier='intermediate')=101,'intermediate batch';
  ASSERT (SELECT count(*) FROM public.academia_activities WHERE session_id=new_session AND tier='expert')=101,'expert batch';
  ASSERT EXISTS(SELECT 1 FROM public.academia_activities a JOIN public.slate_games g ON g.id=a.game_id
    WHERE a.session_id=new_session AND a.kind='question' AND g.id<>game AND (g.status->>'vaultsOpened')::integer=0),'Game copies reset runtime status';
  SELECT a.id INTO new_activity FROM public.academia_activities a WHERE a.session_id=new_session AND a.kind='adventure';
  ASSERT (SELECT pass_pct FROM public.academia_adventure_points WHERE activity_id=new_activity AND scene_id='loop-1')=80,'Adventure point settings';
  ASSERT (SELECT notebook_id FROM public.academia_adventure_questions WHERE activity_id=new_activity)=new_note,'Adventure question copy';
  ASSERT (SELECT audio FROM public.academia_activities WHERE id=new_activity)='{"repeat":false}'::jsonb,'narration configuration';
  SELECT a.id INTO new_activity FROM public.academia_activities a WHERE a.session_id=new_session AND a.kind='mcq';
  ASSERT (SELECT answer FROM public.academia_mcq_items WHERE activity_id=new_activity)='A','MCQ answer key copied';
  ASSERT NOT EXISTS(SELECT 1 FROM public.academia_mcq_attempts ma JOIN public.academia_activities a ON a.ref_id=ma.paper_id WHERE a.id=new_activity),'no copied MCQ marks';
  replay:=public.academia_duplicate_branch('class',c,request);
  ASSERT replay=response,'uncertain retry returns original copy';
  UPDATE public.notebooks SET title='Edited duplicate only',companion_json='{"changed":true}' WHERE id=new_note;
  ASSERT (SELECT md5(to_jsonb(q)::text) FROM public.notebooks q WHERE id=nb)=source_hash,'editing duplicate cannot alter original';
  UPDATE public.notebooks SET title='Edited source only' WHERE id=nb;
  ASSERT (SELECT title FROM public.notebooks WHERE id=new_note)='Edited duplicate only','editing original cannot alter duplicate';
  ASSERT (SELECT count(*) FROM public.academia_subject_teachers WHERE subject_id=new_subject)=1,'teaching assignments retained';
  -- Every root level uses the same graph copier, not a shallow special case.
  FOR kind,target IN SELECT * FROM (VALUES('subject',s),('topic',t),('subtopic',u),('session',se)) roots(k,id) LOOP
    response:=public.academia_duplicate_branch(kind,target,gen_random_uuid());
    ASSERT (response->>'id')::uuid<>target,'all root levels receive fresh ids';
    ASSERT (response->'counts'->>'academia_activities')::integer=302,'all root levels retain descendants';
  END LOOP;
  -- A malformed source must fail before producing an orphaned branch.
  SELECT count(*) INTO before_rows FROM public.notebooks;
  UPDATE public.academia_activities SET ref_id=gen_random_uuid() WHERE id=first_act;
  BEGIN
    PERFORM public.academia_duplicate_branch('session',se,gen_random_uuid());
    RAISE EXCEPTION 'Expected a missing-source failure';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Expected a missing-source failure' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO after_rows FROM public.notebooks;
  ASSERT before_rows=after_rows,'failed duplicate leaves no partial content';
  UPDATE public.academia_activities SET ref_id=nb WHERE id=first_act;
  -- A late write failure must roll back content that was already inserted.
  helper:=pg_get_functiondef('private.academia_copy_remap(jsonb,jsonb)'::regprocedure);
  EXECUTE replace(helper,'CASE jsonb_typeof(_value)',
    '  IF _value->>''title''=''Fixture source note force failure'' THEN RAISE EXCEPTION ''forced rollback fixture''; END IF; CASE jsonb_typeof(_value)');
  UPDATE public.notebooks SET title='Fixture source note force failure' WHERE id=nb;
  SELECT count(*) INTO before_rows FROM public.classes;
  BEGIN
    PERFORM public.academia_duplicate_branch('session',se,gen_random_uuid());
    RAISE EXCEPTION 'Expected forced rollback fixture';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'forced rollback fixture' THEN RAISE; END IF;
  END;
  ASSERT (SELECT count(*) FROM public.classes)=before_rows,'late failure rolls back new hidden classes';
  EXECUTE helper;
  UPDATE public.notebooks SET title='Fixture source note' WHERE id=nb;
  -- NULL org_id must not allow an unrelated private note through SQL NULL logic.
  SELECT id INTO outsider FROM auth.users WHERE id<>actor LIMIT 1;
  IF outsider IS NOT NULL THEN
    target:=gen_random_uuid();
    INSERT INTO public.notebooks(id,owner_id,title,org_id) VALUES(target,outsider,'Private rollback fixture',NULL);
    -- The normal insert trigger stamps the active school; clear it only on
    -- this uncommitted fixture to exercise a genuinely private NULL-org note.
    UPDATE public.notebooks SET org_id=NULL WHERE id=target;
    UPDATE public.academia_activities SET ref_id=target WHERE id=first_act;
    BEGIN
      PERFORM public.academia_duplicate_branch('session',se,gen_random_uuid());
      RAISE EXCEPTION 'Expected private-note failure';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    UPDATE public.academia_activities SET ref_id=nb WHERE id=first_act;
  END IF;
  -- An assigned school teacher can copy an empty topic, not a whole class.
  SELECT user_id INTO teacher FROM public.account_memberships WHERE org_id=org AND status='active' AND user_id<>actor LIMIT 1;
  IF teacher IS NOT NULL THEN
    INSERT INTO public.academia_subject_teachers(subject_id,teacher_id) VALUES(s,teacher);
    target:=gen_random_uuid();INSERT INTO public.academia_topics(id,subject_id,name) VALUES(target,s,'Empty teacher fixture');
    PERFORM set_config('request.jwt.claim.sub',teacher::text,true);
    response:=public.academia_duplicate_branch('topic',target,gen_random_uuid());
    ASSERT (response->>'id')::uuid<>target,'assigned teacher copy';
    BEGIN
      PERFORM public.academia_duplicate_branch('class',c,gen_random_uuid());
      RAISE EXCEPTION 'Expected teacher class-copy failure';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  END IF;
  -- Authentication boundaries are checked before copying anything.
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.academia_duplicate_branch('class',c,gen_random_uuid());
    RAISE EXCEPTION 'Expected unauthenticated failure';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  outsider:=gen_random_uuid();PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  BEGIN
    PERFORM public.academia_duplicate_branch('class',c,gen_random_uuid());
    RAISE EXCEPTION 'Expected outsider failure';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
END $$;

$academia_fixture_body$;
    RAISE EXCEPTION 'All Academia copy fixtures passed' USING ERRCODE='ZX001';
  EXCEPTION
    WHEN SQLSTATE 'ZX001' THEN NULL;
    WHEN OTHERS THEN failure:=SQLSTATE||': '||SQLERRM;
  END;
  IF failure IS NOT NULL THEN RAISE EXCEPTION 'Academia duplication validation failed: %',failure; END IF;
END $academia_fixture_rollback$;
