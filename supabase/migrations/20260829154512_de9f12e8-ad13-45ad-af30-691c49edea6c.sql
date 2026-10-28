CREATE OR REPLACE FUNCTION private.can_access_realtime_topic(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    -- The topic may carry a trailing owner id: assessment-progress-<assessment>-<owner>.
    raw := substring(_topic FROM length('assessment-progress-') + 1);
    raw := substring(raw FROM 1 FOR 36);
    BEGIN aid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    SELECT a.class_id INTO cid FROM public.assessments a WHERE a.id = aid;
    IF cid IS NULL THEN RETURN false; END IF;
    RETURN private.is_class_owner(cid) OR private.is_class_member(cid);
  END IF;
  IF _topic LIKE 'sb-sync-%' THEN raw := substring(_topic FROM length('sb-sync-') + 1);
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