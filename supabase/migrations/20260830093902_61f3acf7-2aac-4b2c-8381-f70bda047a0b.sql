-- EDITABLE 3D BUILDING ENVIRONMENT -- the interior of the existing 3D building: an editable
-- walkway environment whose doors open existing products (never duplicated).

CREATE TABLE public.buildings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Building',
  source_building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
  environment JSONB NOT NULL DEFAULT '{"leftWall":{"preset":"academic","color":"#3a4763","texture":null,"scale":1,"offsetX":0,"offsetY":0,"repeat":false},"rightWall":{"preset":"academic","color":"#3a4763","texture":null,"scale":1,"offsetX":0,"offsetY":0,"repeat":false},"floor":{"preset":"classroom","color":"#232c3d","texture":null,"scale":1,"offsetX":0,"offsetY":0,"repeat":false},"roof":{"preset":"neutral","color":"#141a26","texture":null,"scale":1,"offsetX":0,"offsetY":0,"repeat":false},"door":{"preset":"modern","color":"#1a2542","texture":null,"brightness":1},"lighting":{"brightness":1,"ambient":0.6,"intensity":1.1,"atmosphere":false},"effects":{"enabled":false,"effect":null}}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX buildings_org_idx ON public.buildings (org_id);
CREATE INDEX buildings_owner_idx ON public.buildings (owner_id);

CREATE TABLE public.building_walkways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.building_walkways(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'forward' CHECK (direction IN ('forward','left','right')),
  length REAL NOT NULL DEFAULT 12,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX building_walkways_building_idx ON public.building_walkways (building_id, position);

CREATE TABLE public.building_doors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  walkway_id UUID NOT NULL REFERENCES public.building_walkways(id) ON DELETE CASCADE,
  position_along REAL NOT NULL DEFAULT 0.5 CHECK (position_along >= 0 AND position_along <= 1),
  design JSONB NOT NULL DEFAULT '{"preset":"modern","color":"#1a2542","texture":null,"brightness":1}'::jsonb,
  content_kind TEXT CHECK (content_kind IN ('course','game','adventure','assessment')),
  content_id UUID,
  title_override TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX building_doors_walkway_idx ON public.building_doors (walkway_id, position_along);
CREATE INDEX building_doors_product_idx ON public.building_doors (content_kind, content_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buildings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_walkways TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_doors TO authenticated;
GRANT ALL ON public.buildings TO service_role;
GRANT ALL ON public.building_walkways TO service_role;
GRANT ALL ON public.building_doors TO service_role;

-- Editing rights for one building: creator, workspace owner, or platform admin.
CREATE OR REPLACE FUNCTION public.can_edit_building(_building_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = _building_id
      AND (
        b.owner_id = auth.uid()
        OR (b.org_id IS NOT NULL AND public.is_org_owner(b.org_id))
        OR public.has_role(auth.uid(), 'platform_owner')
        OR public.has_role(auth.uid(), 'co_admin')
      )
  )
$$;

-- Read rights: any active member of the building's workspace, plus the owner.
CREATE OR REPLACE FUNCTION public.can_view_building(_building_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = _building_id
      AND (
        b.owner_id = auth.uid()
        OR (b.org_id IS NOT NULL AND public.is_workspace_member(b.org_id))
        OR public.has_role(auth.uid(), 'platform_owner')
        OR public.has_role(auth.uid(), 'co_admin')
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_edit_building(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_building(UUID) FROM anon;

-- Resolve the building a nested row belongs to, without recursive RLS.
CREATE OR REPLACE FUNCTION public.building_of_walkway(_walkway_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT building_id FROM public.building_walkways WHERE id = _walkway_id
$$;
CREATE OR REPLACE FUNCTION public.building_of_door(_door_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT building_id FROM public.building_doors WHERE id = _door_id
$$;
REVOKE EXECUTE ON FUNCTION public.building_of_walkway(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.building_of_door(UUID) FROM anon;

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_walkways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_doors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buildings_read" ON public.buildings FOR SELECT TO authenticated
  USING (public.can_view_building(id));
CREATE POLICY "buildings_insert" ON public.buildings FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (org_id IS NULL OR public.is_workspace_member(org_id) OR public.is_org_owner(org_id))
  );
CREATE POLICY "buildings_update" ON public.buildings FOR UPDATE TO authenticated
  USING (public.can_edit_building(id)) WITH CHECK (public.can_edit_building(id));
CREATE POLICY "buildings_delete" ON public.buildings FOR DELETE TO authenticated
  USING (public.can_edit_building(id));

CREATE POLICY "building_walkways_read" ON public.building_walkways FOR SELECT TO authenticated
  USING (public.can_view_building(building_id));
CREATE POLICY "building_walkways_write" ON public.building_walkways FOR ALL TO authenticated
  USING (public.can_edit_building(building_id))
  WITH CHECK (public.can_edit_building(building_id));

CREATE POLICY "building_doors_read" ON public.building_doors FOR SELECT TO authenticated
  USING (public.can_view_building(building_id));
CREATE POLICY "building_doors_write" ON public.building_doors FOR ALL TO authenticated
  USING (public.can_edit_building(building_id))
  WITH CHECK (public.can_edit_building(building_id));

CREATE TRIGGER touch_buildings BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();
CREATE TRIGGER touch_building_walkways BEFORE UPDATE ON public.building_walkways
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();
CREATE TRIGGER touch_building_doors BEFORE UPDATE ON public.building_doors
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();