-- ─────────── Organisations: discoverability + invite code ───────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS invite_code text;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_visibility_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_visibility_check CHECK (visibility IN ('public','private'));

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_kind_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_kind_check CHECK (kind IN ('platform','school','teacher','parent','student'));

CREATE UNIQUE INDEX IF NOT EXISTS organizations_invite_code_key
  ON public.organizations (invite_code) WHERE invite_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_org_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE candidate text; tries int := 0;
BEGIN
  LOOP
    candidate := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.organizations WHERE invite_code = candidate);
    tries := tries + 1;
    IF tries > 20 THEN RAISE EXCEPTION 'Could not generate unique invite code'; END IF;
  END LOOP;
  RETURN candidate;
END $$;

UPDATE public.organizations SET invite_code = public.generate_org_invite_code() WHERE invite_code IS NULL;

ALTER TABLE public.organizations ALTER COLUMN invite_code SET DEFAULT public.generate_org_invite_code();

-- ─────────── Active workspace ───────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Personal workspace for every account that does not own one yet.
DO $$
DECLARE rec record; v_org uuid; v_kind text;
BEGIN
  FOR rec IN
    SELECT u.id AS user_id,
           COALESCE((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = u.id LIMIT 1), 'teacher') AS role_name
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.owner_user_id = u.id)
  LOOP
    v_kind := CASE WHEN rec.role_name IN ('school','teacher','parent','student') THEN rec.role_name ELSE 'teacher' END;
    INSERT INTO public.organizations (kind, name, owner_user_id, visibility)
    VALUES (v_kind, COALESCE((SELECT NULLIF(p.display_name,'') FROM public.profiles p WHERE p.user_id = rec.user_id), 'My') || ' workspace',
            rec.user_id, 'public')
    RETURNING id INTO v_org;
    INSERT INTO public.account_memberships (user_id, org_id, role, status)
    VALUES (rec.user_id, v_org, v_kind::public.app_role, 'active')
    ON CONFLICT (user_id, org_id) DO NOTHING;
  END LOOP;
END $$;

-- Membership row for every organisation owner (owners are members of their own workspace).
INSERT INTO public.account_memberships (user_id, org_id, role, status)
SELECT o.owner_user_id, o.id,
       CASE WHEN o.kind IN ('school','teacher','parent','student') THEN o.kind::public.app_role ELSE 'teacher'::public.app_role END,
       'active'
FROM public.organizations o
WHERE o.owner_user_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Default the active workspace to the personal (owned) workspace.
UPDATE public.profiles p
SET active_org_id = o.id
FROM public.organizations o
WHERE o.owner_user_id = p.user_id AND p.active_org_id IS NULL;

-- Active workspace = stored choice when it is still an active membership, else first membership.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.active_org_id
       FROM public.profiles p
       JOIN public.account_memberships m
         ON m.org_id = p.active_org_id AND m.user_id = p.user_id AND m.status = 'active'
      WHERE p.user_id = auth.uid()),
    (SELECT m.org_id FROM public.account_memberships m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
      ORDER BY m.created_at LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.my_workspaces()
RETURNS TABLE(org_id uuid, kind text, name text, role app_role, status text, is_owner boolean, visibility text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.kind, o.name, m.role, m.status,
         (o.owner_user_id = auth.uid()) AS is_owner, o.visibility
  FROM public.account_memberships m
  JOIN public.organizations o ON o.id = m.org_id
  WHERE m.user_id = auth.uid() AND m.status IN ('active','suspended')
  ORDER BY (o.owner_user_id = auth.uid()) DESC, o.name
$$;

CREATE OR REPLACE FUNCTION public.set_active_workspace(_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.account_memberships
    WHERE user_id = auth.uid() AND org_id = _org_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_a_member_of_workspace';
  END IF;
  UPDATE public.profiles SET active_org_id = _org_id WHERE user_id = auth.uid();
  RETURN _org_id;
END $$;

-- ─────────── Workspace membership / roster helpers ───────────
CREATE OR REPLACE FUNCTION public.is_workspace_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_memberships
    WHERE user_id = auth.uid() AND org_id = _org_id AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_workspace(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_workspace_member(_org_id) OR public.owns_org(_org_id)
$$;

CREATE OR REPLACE FUNCTION public.workspace_students(_org_id uuid)
RETURNS TABLE(user_id uuid, display_name text, mathgpl_student_id text, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id,
         COALESCE(NULLIF(p.display_name,''), 'Student ' || left(m.user_id::text, 4)),
         p.mathgpl_student_id,
         m.status
  FROM public.account_memberships m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.org_id = _org_id
    AND m.role = 'student'
    AND public.can_view_workspace(_org_id)
$$;

-- ─────────── Classes belong to a workspace ───────────
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.classes c
SET org_id = public.org_of(c.owner_id)
WHERE c.org_id IS NULL;

CREATE INDEX IF NOT EXISTS classes_org_idx ON public.classes (org_id);

CREATE OR REPLACE FUNCTION public.classes_set_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := COALESCE(public.current_org_id(), public.org_of(NEW.owner_id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS classes_set_org_trg ON public.classes;
CREATE TRIGGER classes_set_org_trg BEFORE INSERT ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.classes_set_org();

-- Joining a class enrols the student in that class's workspace roster.
CREATE OR REPLACE FUNCTION public.class_member_enrols_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.classes WHERE id = NEW.class_id;
  IF v_org IS NOT NULL THEN
    INSERT INTO public.account_memberships (user_id, org_id, role, status)
    VALUES (NEW.user_id, v_org, 'student', 'active')
    ON CONFLICT (user_id, org_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS class_member_enrols_workspace_trg ON public.class_members;
CREATE TRIGGER class_member_enrols_workspace_trg AFTER INSERT ON public.class_members
FOR EACH ROW EXECUTE FUNCTION public.class_member_enrols_workspace();

-- Backfill roster from existing class memberships.
INSERT INTO public.account_memberships (user_id, org_id, role, status)
SELECT cm.user_id, c.org_id, 'student'::public.app_role, 'active'
FROM public.class_members cm
JOIN public.classes c ON c.id = cm.class_id
WHERE c.org_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;

-- ─────────── Security fixes ───────────
DROP POLICY IF EXISTS "Audience links read shared sessions" ON public.sessions;
CREATE POLICY "Audience links read shared public sessions"
ON public.sessions FOR SELECT TO anon
USING (visibility = 'public' AND status IN ('published','live','ended'));

DROP POLICY IF EXISTS "Signed-in users read attempts on published cards" ON public.smart_card_attempts;
CREATE POLICY "Card owners and participants read attempts"
ON public.smart_card_attempts FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.smart_cards c
    WHERE c.id = smart_card_attempts.card_id AND c.owner_id = auth.uid()
  )
);