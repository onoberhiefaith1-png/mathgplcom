-- Chosen sign-in IDs, and student accounts created by a school or teacher.
-- Additive only: the permanent issued ID, its sequence and prefix are untouched,
-- so the existing account_ids_immutable trigger keeps guarding them.

-- 1. A chosen ID, alongside the permanent issued one -----------------------
ALTER TABLE public.account_ids
  ADD COLUMN IF NOT EXISTS custom_id text,
  ADD COLUMN IF NOT EXISTS custom_id_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_id_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Chosen IDs are unique regardless of letter case.
CREATE UNIQUE INDEX IF NOT EXISTS account_ids_custom_id_key
  ON public.account_ids (lower(custom_id))
  WHERE custom_id IS NOT NULL;

-- 2. Students created and owned by a school or a teacher -------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS managed_by_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS managed_by_user_id uuid;

CREATE INDEX IF NOT EXISTS profiles_managed_by_org_idx
  ON public.profiles (managed_by_org_id)
  WHERE managed_by_org_id IS NOT NULL;

-- A managed student belongs to exactly one workspace: the one that created the
-- account. Enforced in the database so no client path can widen it.
CREATE OR REPLACE FUNCTION public.managed_student_single_workspace()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT managed_by_org_id INTO v_owner
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF v_owner IS NOT NULL AND NEW.org_id IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'this student account belongs to one school only';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS account_memberships_managed_student ON public.account_memberships;
CREATE TRIGGER account_memberships_managed_student
BEFORE INSERT OR UPDATE ON public.account_memberships
FOR EACH ROW EXECUTE FUNCTION public.managed_student_single_workspace();