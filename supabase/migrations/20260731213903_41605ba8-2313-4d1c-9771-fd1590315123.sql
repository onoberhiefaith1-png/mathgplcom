-- 1. Platform owner
INSERT INTO public.user_roles (user_id, role)
VALUES ('646e35a6-2172-4647-96a1-cb20c0a4765b', 'platform_owner')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Membership status vocabulary + lookup index
ALTER TABLE public.account_memberships
  DROP CONSTRAINT IF EXISTS account_memberships_status_check;
UPDATE public.account_memberships
  SET status = 'active'
  WHERE status IS NULL OR status NOT IN ('invited','active','suspended');
ALTER TABLE public.account_memberships
  ADD CONSTRAINT account_memberships_status_check
  CHECK (status IN ('invited','active','suspended'));
CREATE INDEX IF NOT EXISTS account_memberships_org_status_idx
  ON public.account_memberships (org_id, status);

-- 3. Helper functions (security definer, no recursion)
CREATE OR REPLACE FUNCTION public.org_of(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.org_id FROM public.account_memberships m
  WHERE m.user_id = _user_id AND m.status IN ('active','suspended')
  ORDER BY m.created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org_id AND o.owner_user_id = auth.uid()
  )
$$;

-- True when the caller owns the organisation that owns _user_id (school/parent
-- oversight of its own teachers). Never true across organisations.
CREATE OR REPLACE FUNCTION public.owner_can_access_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND _user_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.account_memberships m
      JOIN public.organizations o ON o.id = m.org_id
      WHERE m.user_id = _user_id
        AND o.owner_user_id = auth.uid()
    )
$$;

REVOKE ALL ON FUNCTION public.org_of(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_org_owner(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.owner_can_access_user(uuid) FROM anon;

-- 4. Teacher invitations
CREATE TABLE IF NOT EXISTS public.teacher_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  status text NOT NULL DEFAULT 'pending',
  token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  accepted_user_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_invitations_status_check CHECK (status IN ('pending','accepted','revoked','expired'))
);
CREATE UNIQUE INDEX IF NOT EXISTS teacher_invitations_token_idx ON public.teacher_invitations (token);
CREATE INDEX IF NOT EXISTS teacher_invitations_org_idx ON public.teacher_invitations (org_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_invitations TO authenticated;
GRANT ALL ON public.teacher_invitations TO service_role;
ALTER TABLE public.teacher_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owner reads invitations" ON public.teacher_invitations
  FOR SELECT TO authenticated USING (public.is_org_owner(org_id));
CREATE POLICY "Org owner creates invitations" ON public.teacher_invitations
  FOR INSERT TO authenticated WITH CHECK (public.is_org_owner(org_id) AND invited_by = auth.uid());
CREATE POLICY "Org owner updates invitations" ON public.teacher_invitations
  FOR UPDATE TO authenticated USING (public.is_org_owner(org_id)) WITH CHECK (public.is_org_owner(org_id));
CREATE POLICY "Org owner deletes invitations" ON public.teacher_invitations
  FOR DELETE TO authenticated USING (public.is_org_owner(org_id));

CREATE TRIGGER teacher_invitations_touch
  BEFORE UPDATE ON public.teacher_invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Parent - teacher links
CREATE TABLE IF NOT EXISTS public.parent_teacher_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parent_teacher_links_status_check CHECK (status IN ('invited','active','removed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS parent_teacher_links_unique_idx
  ON public.parent_teacher_links (parent_user_id, teacher_user_id, COALESCE(child_user_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_teacher_links TO authenticated;
GRANT ALL ON public.parent_teacher_links TO service_role;
ALTER TABLE public.parent_teacher_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parent or teacher reads link" ON public.parent_teacher_links
  FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid() OR teacher_user_id = auth.uid());
CREATE POLICY "Parent creates link" ON public.parent_teacher_links
  FOR INSERT TO authenticated WITH CHECK (parent_user_id = auth.uid());
CREATE POLICY "Parent updates link" ON public.parent_teacher_links
  FOR UPDATE TO authenticated USING (parent_user_id = auth.uid()) WITH CHECK (parent_user_id = auth.uid());
CREATE POLICY "Parent deletes link" ON public.parent_teacher_links
  FOR DELETE TO authenticated USING (parent_user_id = auth.uid());

CREATE TRIGGER parent_teacher_links_touch
  BEFORE UPDATE ON public.parent_teacher_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. School / parent oversight of its own teachers' content (full access)
CREATE POLICY "Org owner reads member classes" ON public.classes
  FOR SELECT TO authenticated USING (public.owner_can_access_user(owner_id));
CREATE POLICY "Org owner updates member classes" ON public.classes
  FOR UPDATE TO authenticated
  USING (public.owner_can_access_user(owner_id))
  WITH CHECK (public.owner_can_access_user(owner_id));

CREATE POLICY "Org owner reads member notebooks" ON public.notebooks
  FOR SELECT TO authenticated USING (public.owner_can_access_user(owner_id));
CREATE POLICY "Org owner updates member notebooks" ON public.notebooks
  FOR UPDATE TO authenticated
  USING (public.owner_can_access_user(owner_id))
  WITH CHECK (public.owner_can_access_user(owner_id));

CREATE POLICY "Org owner reads member class members" ON public.class_members
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_members.class_id
        AND public.owner_can_access_user(c.owner_id)
    )
  );

CREATE POLICY "Org owner reads member reports" ON public.report_task_results
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = report_task_results.class_id
        AND public.owner_can_access_user(c.owner_id)
    )
  );