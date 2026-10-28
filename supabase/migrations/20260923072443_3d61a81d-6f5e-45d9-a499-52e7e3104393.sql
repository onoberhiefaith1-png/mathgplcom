CREATE TABLE public.aura_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  feature text NOT NULL,
  scope text,
  roles text[] NOT NULL DEFAULT '{}',
  preconditions text[] NOT NULL DEFAULT '{}',
  steps text[] NOT NULL DEFAULT '{}',
  expected_result text,
  verification text,
  failures text[] NOT NULL DEFAULT '{}',
  evidence text,
  status text NOT NULL DEFAULT 'proposed',
  version integer NOT NULL DEFAULT 1,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aura_knowledge_status_check
    CHECK (status IN ('proposed', 'observed', 'approved', 'retired'))
);

CREATE INDEX aura_knowledge_status_idx ON public.aura_knowledge (status);
CREATE INDEX aura_knowledge_feature_idx ON public.aura_knowledge (feature);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aura_knowledge TO authenticated;
GRANT ALL ON public.aura_knowledge TO service_role;

ALTER TABLE public.aura_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read settled knowledge"
  ON public.aura_knowledge FOR SELECT TO authenticated
  USING (status IN ('approved', 'observed') OR author_id = auth.uid());

CREATE POLICY "Admins read every entry"
  ON public.aura_knowledge FOR SELECT TO authenticated
  USING (
    public.has_role((select auth.uid()), 'platform_owner'::public.app_role)
    OR public.has_role((select auth.uid()), 'co_admin'::public.app_role)
  );

CREATE POLICY "Authors propose entries"
  ON public.aura_knowledge FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND status IN ('proposed', 'observed'));

CREATE POLICY "Admins change entries"
  ON public.aura_knowledge FOR UPDATE TO authenticated
  USING (
    public.has_role((select auth.uid()), 'platform_owner'::public.app_role)
    OR public.has_role((select auth.uid()), 'co_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role((select auth.uid()), 'platform_owner'::public.app_role)
    OR public.has_role((select auth.uid()), 'co_admin'::public.app_role)
  );

CREATE POLICY "Admins delete entries"
  ON public.aura_knowledge FOR DELETE TO authenticated
  USING (
    public.has_role((select auth.uid()), 'platform_owner'::public.app_role)
    OR public.has_role((select auth.uid()), 'co_admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.touch_aura_knowledge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER aura_knowledge_updated_at
  BEFORE UPDATE ON public.aura_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.touch_aura_knowledge();