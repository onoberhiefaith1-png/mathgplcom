CREATE TYPE public.app_role AS ENUM ('platform_owner','co_admin','school','teacher','parent','student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'platform_owner' THEN 0 WHEN 'co_admin' THEN 1 WHEN 'school' THEN 2
    WHEN 'teacher' THEN 3 WHEN 'parent' THEN 4 ELSE 5 END
  LIMIT 1
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Platform admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_owner') OR public.has_role(auth.uid(),'co_admin'));

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('platform','school','teacher','parent')),
  name text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organizations_owner_idx ON public.organizations(owner_user_id);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER organizations_touch BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.account_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);
CREATE INDEX account_memberships_org_idx ON public.account_memberships(org_id);
GRANT SELECT, INSERT, UPDATE ON public.account_memberships TO authenticated;
GRANT ALL ON public.account_memberships TO service_role;
ALTER TABLE public.account_memberships ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER account_memberships_touch BEFORE UPDATE ON public.account_memberships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.account_memberships
  WHERE user_id = auth.uid() AND status = 'active'
  ORDER BY created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.owns_org(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _org_id AND o.owner_user_id = auth.uid())
$$;

CREATE POLICY "Read own organization" ON public.organizations
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR id = public.current_org_id()
         OR public.has_role(auth.uid(),'platform_owner') OR public.has_role(auth.uid(),'co_admin'));
CREATE POLICY "Create own organization" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Update own organization" ON public.organizations
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Read own membership" ON public.account_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owns_org(org_id)
         OR public.has_role(auth.uid(),'platform_owner') OR public.has_role(auth.uid(),'co_admin'));
CREATE POLICY "Create membership in own org" ON public.account_memberships
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.owns_org(org_id));
CREATE POLICY "Owner updates memberships" ON public.account_memberships
  FOR UPDATE TO authenticated USING (public.owns_org(org_id)) WITH CHECK (public.owns_org(org_id));

CREATE TABLE public.parent_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, child_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.parent_children TO authenticated;
GRANT ALL ON public.parent_children TO service_role;
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parent or child reads link" ON public.parent_children
  FOR SELECT TO authenticated USING (parent_user_id = auth.uid() OR child_user_id = auth.uid());
CREATE POLICY "Parent creates link" ON public.parent_children
  FOR INSERT TO authenticated WITH CHECK (parent_user_id = auth.uid());
CREATE POLICY "Parent removes link" ON public.parent_children
  FOR DELETE TO authenticated USING (parent_user_id = auth.uid());

CREATE TABLE public.role_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  capability text NOT NULL,
  scope text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, capability)
);
GRANT SELECT ON public.role_capabilities TO authenticated;
GRANT ALL ON public.role_capabilities TO service_role;
ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone reads capabilities" ON public.role_capabilities
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_capability(_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_capabilities c
    JOIN public.user_roles r ON r.role = c.role
    WHERE r.user_id = auth.uid() AND c.capability = _capability
  )
$$;

INSERT INTO public.role_capabilities (role, capability, scope) VALUES
  ('platform_owner','platform_admin','all'),
  ('co_admin','platform_admin','delegated'),
  ('school','create_class','all'), ('school','join_class','all'),
  ('school','create_lesson_notes','all'), ('school','view_lesson_notes','all'),
  ('school','ai_generation','all'), ('school','manage_teachers','all'),
  ('school','manage_students','all'), ('school','billing','all'),
  ('school','reports','all'), ('school','smartboard','all'),
  ('school','analytics','all'), ('school','manage_accounts','all'),
  ('teacher','create_class','own'), ('teacher','join_class','own'),
  ('teacher','create_lesson_notes','own'), ('teacher','view_lesson_notes','own'),
  ('teacher','ai_generation','own'), ('teacher','manage_students','own'),
  ('teacher','billing','own'), ('teacher','reports','own'), ('teacher','smartboard','own'),
  ('parent','view_lesson_notes','children'), ('parent','manage_students','children'),
  ('parent','manage_teachers','limited'), ('parent','billing','own'),
  ('parent','reports','children'), ('parent','smartboard','view'),
  ('student','join_class','own'), ('student','view_lesson_notes','enrolled'),
  ('student','reports','self'), ('student','smartboard','participate');

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'teacher'::public.app_role FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

WITH new_orgs AS (
  INSERT INTO public.organizations (kind, name, owner_user_id)
  SELECT 'teacher',
         COALESCE(NULLIF(p.display_name,''), split_part(u.email,'@',1), 'Teacher') || ' workspace',
         u.id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  RETURNING id, owner_user_id
)
INSERT INTO public.account_memberships (user_id, org_id, role)
SELECT owner_user_id, id, 'teacher'::public.app_role FROM new_orgs
ON CONFLICT (user_id, org_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
  v_org uuid;
  v_name text;
BEGIN
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'account_role',''), 'teacher')::public.app_role;
  IF v_role NOT IN ('school','teacher','parent','student') THEN
    v_role := 'teacher';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role IN ('school','teacher','parent') THEN
    v_name := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'organization_name',''),
      NULLIF(NEW.raw_user_meta_data->>'display_name',''),
      split_part(NEW.email,'@',1)
    );
    INSERT INTO public.organizations (kind, name, owner_user_id)
    VALUES (v_role::text, v_name || ' workspace', NEW.id)
    RETURNING id INTO v_org;

    INSERT INTO public.account_memberships (user_id, org_id, role)
    VALUES (NEW.id, v_org, v_role) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;