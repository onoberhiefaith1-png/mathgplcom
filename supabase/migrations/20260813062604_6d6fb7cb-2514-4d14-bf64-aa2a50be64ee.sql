DROP POLICY IF EXISTS "Published plan versions are public" ON public.plan_versions;

REVOKE SELECT ON public.plan_versions FROM anon;
REVOKE SELECT ON public.plan_versions FROM authenticated;

GRANT SELECT (id, plan_id, version_no, label, description, price, platform_amount, credit_amount, currency, included_credits, status, published_at, created_at, updated_at)
  ON public.plan_versions TO authenticated;

GRANT ALL ON public.plan_versions TO service_role;

CREATE POLICY "Published plan versions readable by signed-in users"
  ON public.plan_versions FOR SELECT TO authenticated
  USING (status = 'published');