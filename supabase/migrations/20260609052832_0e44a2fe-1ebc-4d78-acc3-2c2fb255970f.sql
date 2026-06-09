-- Helper: decide whether the current user may access a given realtime topic.
CREATE OR REPLACE FUNCTION public.can_access_realtime_topic(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  raw text;
BEGIN
  IF uid IS NULL OR _topic IS NULL THEN
    RETURN false;
  END IF;

  -- Personal membership channel: only the owner of the topic.
  IF _topic LIKE 'member-of-%' THEN
    RETURN _topic = 'member-of-' || uid::text;
  END IF;

  -- Owner-only: join requests for a class.
  IF _topic LIKE 'join-requests-%' THEN
    raw := substring(_topic FROM length('join-requests-') + 1);
    BEGIN cid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
    RETURN public.is_class_owner(cid);
  END IF;

  -- Class channels: owner or member may subscribe.
  IF _topic LIKE 'sb-sync-%' THEN
    raw := substring(_topic FROM length('sb-sync-') + 1);
  ELSIF _topic LIKE 'smartboard-state-%' THEN
    raw := substring(_topic FROM length('smartboard-state-') + 1);
  ELSIF _topic LIKE 'class-visibility-%' THEN
    raw := substring(_topic FROM length('class-visibility-') + 1);
  ELSIF _topic LIKE 'class-notes-%' THEN
    raw := substring(_topic FROM length('class-notes-') + 1);
  ELSIF _topic LIKE 'active-student-members-%' THEN
    raw := substring(_topic FROM length('active-student-members-') + 1);
  ELSE
    RETURN false;
  END IF;

  BEGIN cid := raw::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN public.is_class_owner(cid) OR public.is_class_member(cid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_realtime_topic(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_realtime_topic(text) TO authenticated;

-- Enable Realtime Authorization on the messages relay.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read authorized topics" ON realtime.messages;
CREATE POLICY "Authenticated users read authorized topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.can_access_realtime_topic((SELECT realtime.topic())));

DROP POLICY IF EXISTS "Authenticated users write authorized topics" ON realtime.messages;
CREATE POLICY "Authenticated users write authorized topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_realtime_topic((SELECT realtime.topic())));