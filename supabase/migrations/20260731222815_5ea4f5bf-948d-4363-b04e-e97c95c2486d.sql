CREATE TABLE public.platform_test_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_user_id)
);

GRANT SELECT ON public.platform_test_accounts TO authenticated;
GRANT ALL ON public.platform_test_accounts TO service_role;

ALTER TABLE public.platform_test_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own test accounts"
  ON public.platform_test_accounts FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

CREATE INDEX platform_test_accounts_owner_idx ON public.platform_test_accounts (owner_user_id);