-- 1) Extend the realtime topic authorization helper with the student board topic.
CREATE OR REPLACE FUNCTION private.can_access_realtime_topic(_topic text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid(); cid uuid; aid uuid; raw text;
BEGIN
  IF uid IS NULL OR _topic IS NULL THEN RETURN false; END IF;
  IF _topic LIKE 'member-of-%' THEN RETURN _topic = 'member-of-' || uid::text; END IF;
  IF _topic LIKE 'join-requests-%' THEN
    raw := substring(_topic FROM length('join-requests-') + 1);
    BEGIN cid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    RETURN private.is_class_owner(cid);
  END IF;
  IF _topic LIKE 'assessment-progress-%' THEN
    raw := substring(_topic FROM length('assessment-progress-') + 1);
    raw := substring(raw FROM 1 FOR 36);
    BEGIN aid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    SELECT a.class_id INTO cid FROM public.assessments a WHERE a.id = aid;
    IF cid IS NULL THEN RETURN false; END IF;
    RETURN private.is_class_owner(cid) OR private.is_class_member(cid);
  END IF;
  IF _topic LIKE 'sb-sync-%' THEN raw := substring(_topic FROM length('sb-sync-') + 1);
  ELSIF _topic LIKE 'student-class-smartboard-%' THEN raw := substring(_topic FROM length('student-class-smartboard-') + 1);
  ELSIF _topic LIKE 'smartboard-state-%' THEN raw := substring(_topic FROM length('smartboard-state-') + 1);
  ELSIF _topic LIKE 'class-visibility-%' THEN raw := substring(_topic FROM length('class-visibility-') + 1);
  ELSIF _topic LIKE 'class-notes-%' THEN raw := substring(_topic FROM length('class-notes-') + 1);
  ELSIF _topic LIKE 'active-student-members-%' THEN raw := substring(_topic FROM length('active-student-members-') + 1);
  ELSIF _topic LIKE 'class-assessments-%' THEN raw := substring(_topic FROM length('class-assessments-') + 1);
  ELSE RETURN false; END IF;
  BEGIN cid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN private.is_class_owner(cid) OR private.is_class_member(cid);
END;
$function$;

-- 2) Private realtime channels are authorized against realtime.messages RLS.
--    Without these policies every private channel JOIN is refused, so live
--    board deltas never arrive and delivery falls back to slow polling.
DROP POLICY IF EXISTS "Class members read their live room" ON realtime.messages;
CREATE POLICY "Class members read their live room"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.can_access_realtime_topic(realtime.topic()));

DROP POLICY IF EXISTS "Class members write their live room" ON realtime.messages;
CREATE POLICY "Class members write their live room"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_realtime_topic(realtime.topic()));

-- 3) Anonymous visitors of an open live session must not read physical venue
--    location data. Replace the broad anon-readable policy with a
--    member/owner-only path; the public Live room reads its data through the
--    existing security-definer session functions.
DROP POLICY IF EXISTS "Audience reads the live session class" ON public.classes;
CREATE POLICY "Audience reads the live session class"
ON public.classes
FOR SELECT
TO authenticated
USING (
  public.class_has_open_live_session(id)
  AND (public.is_class_owner(id) OR public.is_class_member(id))
);