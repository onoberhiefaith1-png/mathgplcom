-- Additive: audit trail for platform-owner workspace entry + dashboard background preference
CREATE TABLE IF NOT EXISTS public.admin_impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_impersonation_log TO authenticated;
GRANT ALL ON public.admin_impersonation_log TO service_role;

ALTER TABLE public.admin_impersonation_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_impersonation_log'
      AND policyname = 'Platform admins read impersonation log'
  ) THEN
    CREATE POLICY "Platform admins read impersonation log"
      ON public.admin_impersonation_log
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'platform_owner'::public.app_role)
        OR public.has_role(auth.uid(), 'co_admin'::public.app_role)
      );
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dashboard_background text;