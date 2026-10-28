-- Relationship types. A connection is always between two independent accounts.
DO $$ BEGIN
  CREATE TYPE public.connection_relation AS ENUM (
    'school_teacher', 'school_student', 'teacher_student',
    'parent_child', 'parent_teacher', 'parent_school'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relation public.connection_relation NOT NULL,
  -- request direction
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- the workspace the relationship belongs to, for school relationships
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
  message text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connections_distinct_accounts CHECK (from_user_id <> to_user_id)
);

GRANT SELECT ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read their connections"
ON public.connections FOR SELECT TO authenticated
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS connections_live_pair_idx
ON public.connections (
  relation,
  least(from_user_id, to_user_id),
  greatest(from_user_id, to_user_id),
  COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS connections_to_status_idx ON public.connections (to_user_id, status);
CREATE INDEX IF NOT EXISTS connections_from_status_idx ON public.connections (from_user_id, status);

CREATE TRIGGER connections_touch BEFORE UPDATE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- The account type of any account, read from the role registry.
CREATE OR REPLACE FUNCTION public.account_role_of(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'platform_owner' THEN 0 WHEN 'co_admin' THEN 1 WHEN 'school' THEN 2
    WHEN 'teacher' THEN 3 WHEN 'parent' THEN 4 ELSE 5 END
  LIMIT 1
$$;

-- Is there an accepted relationship of this kind between two accounts?
CREATE OR REPLACE FUNCTION public.is_connected(_a uuid, _b uuid, _relation public.connection_relation)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.status = 'accepted'
      AND c.relation = _relation
      AND ((c.from_user_id = _a AND c.to_user_id = _b)
        OR (c.from_user_id = _b AND c.to_user_id = _a))
  )
$$;

-- Start a request. Either side of a relationship may initiate it.
CREATE OR REPLACE FUNCTION public.request_connection(
  _target_user_id uuid,
  _relation public.connection_relation,
  _message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_my_role public.app_role;
  v_their_role public.app_role;
  v_roles public.app_role[];
  v_org uuid;
  v_school uuid;
  v_id uuid;
  v_existing public.connections;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _target_user_id IS NULL OR _target_user_id = v_me THEN RAISE EXCEPTION 'invalid_target'; END IF;

  v_my_role := public.account_role_of(v_me);
  v_their_role := public.account_role_of(_target_user_id);
  IF v_my_role IS NULL OR v_their_role IS NULL THEN RAISE EXCEPTION 'unknown_account'; END IF;

  -- The pair of account types the relationship requires, in any order.
  v_roles := CASE _relation
    WHEN 'school_teacher'  THEN ARRAY['school','teacher']::public.app_role[]
    WHEN 'school_student'  THEN ARRAY['school','student']::public.app_role[]
    WHEN 'teacher_student' THEN ARRAY['teacher','student']::public.app_role[]
    WHEN 'parent_child'    THEN ARRAY['parent','student']::public.app_role[]
    WHEN 'parent_teacher'  THEN ARRAY['parent','teacher']::public.app_role[]
    WHEN 'parent_school'   THEN ARRAY['parent','school']::public.app_role[]
  END;

  IF NOT ((v_my_role = v_roles[1] AND v_their_role = v_roles[2])
       OR (v_my_role = v_roles[2] AND v_their_role = v_roles[1])) THEN
    RAISE EXCEPTION 'relation_not_valid_for_these_accounts';
  END IF;

  -- School relationships are scoped to the school's workspace.
  IF _relation IN ('school_teacher', 'school_student', 'parent_school') THEN
    v_school := CASE WHEN v_my_role = 'school' THEN v_me ELSE _target_user_id END;
    SELECT o.id INTO v_org
    FROM public.organizations o
    WHERE o.owner_user_id = v_school AND o.kind = 'school'
    ORDER BY o.created_at LIMIT 1;
    IF v_org IS NULL THEN RAISE EXCEPTION 'school_workspace_not_found'; END IF;
  END IF;

  SELECT * INTO v_existing FROM public.connections c
  WHERE c.relation = _relation
    AND c.status IN ('pending', 'accepted')
    AND COALESCE(c.org_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(v_org, '00000000-0000-0000-0000-000000000000'::uuid)
    AND ((c.from_user_id = v_me AND c.to_user_id = _target_user_id)
      OR (c.from_user_id = _target_user_id AND c.to_user_id = v_me))
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN RETURN v_existing.id; END IF;

  INSERT INTO public.connections (relation, from_user_id, to_user_id, org_id, message)
  VALUES (_relation, v_me, _target_user_id, v_org, NULLIF(_message, ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- Accept or reject. Only the receiving side may answer.
CREATE OR REPLACE FUNCTION public.respond_to_connection(_connection_id uuid, _accept boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.connections;
  v_member uuid;
  v_member_role public.app_role;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.connections
  WHERE id = _connection_id AND to_user_id = v_me AND status = 'pending'
  FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;

  IF NOT _accept THEN
    UPDATE public.connections SET status = 'rejected', responded_at = now() WHERE id = _connection_id;
    RETURN 'rejected';
  END IF;

  UPDATE public.connections SET status = 'accepted', responded_at = now() WHERE id = _connection_id;

  -- Joining a school creates a workspace membership; it never changes identity.
  IF v_row.relation IN ('school_teacher', 'school_student') AND v_row.org_id IS NOT NULL THEN
    v_member := CASE
      WHEN public.account_role_of(v_row.from_user_id) = 'school' THEN v_row.to_user_id
      ELSE v_row.from_user_id END;
    v_member_role := CASE WHEN v_row.relation = 'school_teacher' THEN 'teacher' ELSE 'student' END;

    INSERT INTO public.account_memberships (user_id, org_id, role, status)
    VALUES (v_member, v_row.org_id, v_member_role, 'active')
    ON CONFLICT (user_id, org_id) DO UPDATE SET status = 'active';
  END IF;

  RETURN 'accepted';
END $$;

-- Withdraw a request you sent, or end a relationship you are part of.
CREATE OR REPLACE FUNCTION public.revoke_connection(_connection_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.connections;
  v_member uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.connections
  WHERE id = _connection_id
    AND (from_user_id = v_me OR to_user_id = v_me)
    AND status IN ('pending', 'accepted')
  FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'connection_not_found'; END IF;

  UPDATE public.connections SET status = 'revoked', responded_at = now() WHERE id = _connection_id;

  IF v_row.relation IN ('school_teacher', 'school_student') AND v_row.org_id IS NOT NULL THEN
    v_member := CASE
      WHEN public.account_role_of(v_row.from_user_id) = 'school' THEN v_row.to_user_id
      ELSE v_row.from_user_id END;
    UPDATE public.account_memberships SET status = 'removed'
    WHERE user_id = v_member AND org_id = v_row.org_id;
  END IF;

  RETURN 'revoked';
END $$;

-- Everything the Requests area and the dashboards need to read.
CREATE OR REPLACE FUNCTION public.my_connections(_status text DEFAULT 'accepted')
RETURNS TABLE(
  id uuid, relation public.connection_relation, status text, direction text,
  counterpart_user_id uuid, counterpart_name text, counterpart_mathgpl_id text,
  counterpart_role app_role, org_id uuid, org_name text,
  message text, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.relation, c.status,
         CASE WHEN c.from_user_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
         other.user_id,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         a.mathgpl_id, a.role,
         c.org_id, o.name,
         c.message, c.created_at
  FROM public.connections c
  CROSS JOIN LATERAL (
    SELECT CASE WHEN c.from_user_id = auth.uid() THEN c.to_user_id ELSE c.from_user_id END AS user_id
  ) other
  LEFT JOIN public.profiles p ON p.user_id = other.user_id
  LEFT JOIN public.account_ids a ON a.user_id = other.user_id
  LEFT JOIN public.organizations o ON o.id = c.org_id
  WHERE auth.uid() IS NOT NULL
    AND (c.from_user_id = auth.uid() OR c.to_user_id = auth.uid())
    AND (_status IS NULL OR _status = 'all' OR c.status = _status)
  ORDER BY c.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.my_connection_counts()
RETURNS TABLE(schools int, teachers int, students int, children int, parents int, pending_incoming int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT c.*, CASE WHEN c.from_user_id = auth.uid() THEN c.to_user_id ELSE c.from_user_id END AS other
    FROM public.connections c
    WHERE auth.uid() IS NOT NULL AND (c.from_user_id = auth.uid() OR c.to_user_id = auth.uid())
  )
  SELECT
    (SELECT count(DISTINCT other) FROM mine m JOIN public.user_roles r ON r.user_id = m.other AND r.role = 'school'  WHERE m.status = 'accepted')::int,
    (SELECT count(DISTINCT other) FROM mine m JOIN public.user_roles r ON r.user_id = m.other AND r.role = 'teacher' WHERE m.status = 'accepted')::int,
    (SELECT count(DISTINCT other) FROM mine m JOIN public.user_roles r ON r.user_id = m.other AND r.role = 'student' WHERE m.status = 'accepted' AND m.relation <> 'parent_child')::int,
    (SELECT count(DISTINCT other) FROM mine m WHERE m.status = 'accepted' AND m.relation = 'parent_child')::int,
    (SELECT count(DISTINCT other) FROM mine m JOIN public.user_roles r ON r.user_id = m.other AND r.role = 'parent'  WHERE m.status = 'accepted')::int,
    (SELECT count(*) FROM mine m WHERE m.status = 'pending' AND m.to_user_id = auth.uid())::int
$$;

-- Carry existing relationships over as already-accepted connections.
INSERT INTO public.connections (relation, from_user_id, to_user_id, org_id, status, responded_at)
SELECT CASE WHEN m.role = 'teacher' THEN 'school_teacher' ELSE 'school_student' END::public.connection_relation,
       o.owner_user_id, m.user_id, o.id, 'accepted', now()
FROM public.account_memberships m
JOIN public.organizations o ON o.id = m.org_id
WHERE o.kind = 'school'
  AND m.status = 'active'
  AND m.role IN ('teacher', 'student')
  AND m.user_id <> o.owner_user_id
ON CONFLICT DO NOTHING;

INSERT INTO public.connections (relation, from_user_id, to_user_id, status, responded_at)
SELECT 'parent_teacher', l.parent_user_id, l.teacher_user_id, 'accepted', now()
FROM public.parent_teacher_links l
WHERE l.status = 'active' AND l.parent_user_id <> l.teacher_user_id
ON CONFLICT DO NOTHING;

INSERT INTO public.connections (relation, from_user_id, to_user_id, status, responded_at)
SELECT 'parent_child', pc.parent_user_id, pc.child_user_id, 'accepted', now()
FROM public.parent_children pc
WHERE pc.parent_user_id <> pc.child_user_id
ON CONFLICT DO NOTHING;

INSERT INTO public.connections (relation, from_user_id, to_user_id, status, responded_at)
SELECT DISTINCT 'teacher_student'::public.connection_relation, c.owner_id, cm.user_id, 'accepted', now()
FROM public.class_members cm
JOIN public.classes c ON c.id = cm.class_id
WHERE cm.user_id <> c.owner_id
  AND public.account_role_of(cm.user_id) = 'student'
  AND public.account_role_of(c.owner_id) = 'teacher'
ON CONFLICT DO NOTHING;

-- These helpers all require a signed-in caller; keep them off the anonymous API.
REVOKE EXECUTE ON FUNCTION public.request_connection(uuid, public.connection_relation, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_connection(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_connection(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_connections(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_connection_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_share_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_share_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_my_share_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_go_live(boolean) FROM anon;
