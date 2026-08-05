DROP POLICY IF EXISTS "Create membership in own org" ON public.account_memberships;

CREATE POLICY "Org owner adds memberships"
ON public.account_memberships
FOR INSERT TO authenticated
WITH CHECK (public.owns_org(org_id));

CREATE POLICY "Self join as student only"
ON public.account_memberships
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'student'::app_role);