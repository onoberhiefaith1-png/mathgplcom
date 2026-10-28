ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notebooks_org_owner_idx ON public.notebooks (owner_id, org_id);
CREATE INDEX IF NOT EXISTS games_org_owner_idx ON public.games (owner_id, org_id);

CREATE OR REPLACE FUNCTION public.stamp_active_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (
      SELECT o.id FROM public.organizations o
      WHERE o.id = public.current_org_id() AND o.kind = 'school'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notebooks_set_org ON public.notebooks;
CREATE TRIGGER notebooks_set_org BEFORE INSERT ON public.notebooks
FOR EACH ROW EXECUTE FUNCTION public.stamp_active_org();

DROP TRIGGER IF EXISTS games_set_org ON public.games;
CREATE TRIGGER games_set_org BEFORE INSERT ON public.games
FOR EACH ROW EXECUTE FUNCTION public.stamp_active_org();

-- A school may observe only the work created inside that school.
DROP POLICY IF EXISTS "Org owner reads member notebooks" ON public.notebooks;
CREATE POLICY "School reads notebooks in its workspace"
ON public.notebooks FOR SELECT TO authenticated
USING (org_id IS NOT NULL AND public.is_org_owner(org_id) AND owner_id <> auth.uid());

DROP POLICY IF EXISTS "Org owner updates member notebooks" ON public.notebooks;

CREATE POLICY "School reads games in its workspace"
ON public.games FOR SELECT TO authenticated
USING (org_id IS NOT NULL AND public.is_org_owner(org_id) AND owner_id <> auth.uid());

-- School membership comes before class membership.
CREATE OR REPLACE FUNCTION public.class_join_gate(code text)
RETURNS TABLE(id uuid, name text, org_id uuid, allowed boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.org_id,
         (
           o.id IS NULL
           OR public.is_workspace_member(o.id)
           OR public.is_org_owner(o.id)
         ) AS allowed
  FROM public.class_join_codes j
  JOIN public.classes c ON c.id = j.class_id
  LEFT JOIN public.organizations o ON o.id = c.org_id
  WHERE j.join_code = upper(code)
  LIMIT 1
$$;