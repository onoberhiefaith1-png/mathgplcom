-- Which rotating building is on screen.
--
-- The face used to come from each viewer's own homepage_config (and a
-- localStorage copy of it), from hard-coded slot artwork, or from a Free
-- building record seeded once and never updated. Creating a new building only
-- marked that row active for its owner, so everyone else kept the old face.
--
-- The platform owner now has two live selections (Pro and Free). A pro teacher
-- or a pro school can set one for their own workspace. Everyone else reads the
-- resolved face through get_resolved_building. Students and free accounts
-- cannot write. Schools are never a free tier. Accounts linked to an admin in
-- platform_test_accounts count as admin, same as is_flow_admin.
--
-- Mirrors src/lib/homepage/resolveDisplayedBuilding.ts.

CREATE OR REPLACE FUNCTION public.is_building_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.is_flow_admin(_uid)
    OR EXISTS (
      SELECT 1
      FROM public.platform_test_accounts t
      WHERE t.target_user_id = _uid
        AND public.is_flow_admin(t.owner_user_id)
    )
  )
$$;

REVOKE ALL ON FUNCTION public.is_building_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_building_admin(uuid) TO authenticated, service_role;

-- Pro or Free for the platform building a viewer falls back to.
-- Schools are never free. Students always take Pro (they see the owner's Pro
-- building). Access-code holders take Pro. Admins take Pro.
CREATE OR REPLACE FUNCTION public.building_tier_of(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_price numeric;
  v_plan text;
  v_free boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN 'free';
  END IF;
  IF public.is_building_admin(_user_id) THEN
    RETURN 'pro';
  END IF;
  v_role := public.account_role_of(_user_id);
  IF v_role IN ('platform_owner', 'co_admin', 'school', 'student') THEN
    RETURN 'pro';
  END IF;
  IF public.has_free_access(_user_id) THEN
    RETURN 'pro';
  END IF;

  SELECT COALESCE(s.final_price, 0),
         COALESCE(s.plan_id, s.plan, ''),
         COALESCE(p.is_free, false)
    INTO v_price, v_plan, v_free
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.key = COALESCE(s.plan_id, s.plan)
  WHERE s.user_id = _user_id
    AND s.status IN ('active', 'expired')
  ORDER BY s.period_start DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'free';
  END IF;
  IF v_free OR v_price <= 0 OR v_plan ILIKE '%free%' THEN
    RETURN 'free';
  END IF;
  RETURN 'pro';
END;
$$;

REVOKE ALL ON FUNCTION public.building_tier_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.building_tier_of(uuid) TO authenticated, service_role;

-- Who may write a building choice. Students never. Free accounts never.
-- Schools always (they are never free). Pro teachers yes. Admins yes.
CREATE OR REPLACE FUNCTION public.account_may_select_building(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_building_admin(_user_id)
    OR public.account_role_of(_user_id) = 'school'
    OR (
      public.account_role_of(_user_id) = 'teacher'
      AND public.building_tier_of(_user_id) = 'pro'
    )
  )
$$;

REVOKE ALL ON FUNCTION public.account_may_select_building(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_may_select_building(uuid) TO authenticated, service_role;

-- Interior edits follow the same people. A student or a free account who owns
-- a row still cannot change it.
CREATE OR REPLACE FUNCTION public.can_edit_building(_building_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.account_may_select_building(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.buildings b
      WHERE b.id = _building_id
        AND (
          b.owner_id = auth.uid()
          OR (b.org_id IS NOT NULL AND public.is_org_owner(b.org_id))
          OR public.is_building_admin(auth.uid())
        )
    )
$$;

DROP POLICY IF EXISTS "buildings_insert" ON public.buildings;
CREATE POLICY "buildings_insert" ON public.buildings
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.account_may_select_building(auth.uid())
    AND (
      org_id IS NULL
      OR public.is_org_owner(org_id)
      OR public.is_building_admin(auth.uid())
    )
  );

CREATE TABLE IF NOT EXISTS public.platform_building_selection (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  pro_building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
  free_building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_building_selection (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  set_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_building_selection TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_building_selection TO authenticated;
GRANT ALL ON public.platform_building_selection TO service_role;

GRANT SELECT ON public.workspace_building_selection TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.workspace_building_selection TO authenticated;
GRANT ALL ON public.workspace_building_selection TO service_role;

ALTER TABLE public.platform_building_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_building_selection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform building selection read" ON public.platform_building_selection;
CREATE POLICY "platform building selection read"
  ON public.platform_building_selection
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "platform building selection write" ON public.platform_building_selection;
CREATE POLICY "platform building selection write"
  ON public.platform_building_selection
  FOR ALL TO authenticated
  USING (public.is_building_admin(auth.uid()))
  WITH CHECK (public.is_building_admin(auth.uid()));

DROP POLICY IF EXISTS "workspace building selection read" ON public.workspace_building_selection;
CREATE POLICY "workspace building selection read"
  ON public.workspace_building_selection
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "workspace building selection write" ON public.workspace_building_selection;
CREATE POLICY "workspace building selection write"
  ON public.workspace_building_selection
  FOR ALL TO authenticated
  USING (
    public.account_may_select_building(auth.uid())
    AND (public.is_org_owner(org_id) OR public.is_building_admin(auth.uid()))
  )
  WITH CHECK (
    public.account_may_select_building(auth.uid())
    AND (public.is_org_owner(org_id) OR public.is_building_admin(auth.uid()))
  );

INSERT INTO public.platform_building_selection (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- The building the owner last marked active becomes both live selections, so
-- viewers leave the shipped artwork and the one-time Free seed. An empty face
-- picks up the homepage she already saved. She can point Pro and Free at
-- different buildings afterwards, including older ones.
DO $$
DECLARE
  v_id uuid;
  v_owner uuid;
BEGIN
  SELECT b.id, b.owner_id INTO v_id, v_owner
  FROM public.buildings b
  JOIN public.user_roles r ON r.user_id = b.owner_id AND r.role = 'platform_owner'
  WHERE b.is_active
  ORDER BY b.updated_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.buildings b
  SET exterior_config = p.homepage_config
  FROM public.profiles p
  WHERE b.id = v_id
    AND p.user_id = v_owner
    AND (b.exterior_config IS NULL OR b.exterior_config = '{}'::jsonb)
    AND COALESCE(p.homepage_config, '{}'::jsonb) <> '{}'::jsonb;

  UPDATE public.platform_building_selection
  SET pro_building_id = v_id,
      free_building_id = v_id,
      updated_by = v_owner,
      updated_at = now()
  WHERE id IS TRUE
    AND pro_building_id IS NULL
    AND free_building_id IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.select_displayed_building(
  _building_id uuid,
  _org_id uuid DEFAULT NULL,
  _tier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_kind text;
  v_owner uuid;
  v_tier text := lower(COALESCE(_tier, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _building_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.buildings WHERE id = _building_id) THEN
    RAISE EXCEPTION 'unknown_building';
  END IF;

  -- Admins, including accounts linked to an admin, set the platform Pro or
  -- Free building. That is the face other people see for that tier.
  IF public.is_building_admin(v_uid) AND v_tier IN ('pro', 'free') THEN
    UPDATE public.platform_building_selection
    SET pro_building_id = CASE WHEN v_tier = 'pro' THEN _building_id ELSE pro_building_id END,
        free_building_id = CASE WHEN v_tier = 'free' THEN _building_id ELSE free_building_id END,
        updated_by = v_uid,
        updated_at = now()
    WHERE id IS TRUE;
    IF EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = _building_id AND b.owner_id = v_uid) THEN
      UPDATE public.buildings
      SET is_active = false
      WHERE owner_id = v_uid
        AND id <> _building_id
        AND org_id IS NOT DISTINCT FROM (SELECT b.org_id FROM public.buildings b WHERE b.id = _building_id);
      UPDATE public.buildings SET is_active = true WHERE id = _building_id;
    END IF;
    RETURN jsonb_build_object('scope', 'platform', 'tier', v_tier, 'buildingId', _building_id);
  END IF;

  IF public.account_role_of(v_uid) = 'student' THEN
    RAISE EXCEPTION 'Students cannot change the building';
  END IF;
  IF public.building_tier_of(v_uid) = 'free' AND public.account_role_of(v_uid) IS DISTINCT FROM 'school' THEN
    RAISE EXCEPTION 'A free account cannot change the building';
  END IF;
  IF NOT public.account_may_select_building(v_uid) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  v_role := public.account_role_of(v_uid);
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'workspace_required';
  END IF;

  SELECT o.kind, o.owner_user_id INTO v_kind, v_owner
  FROM public.organizations o
  WHERE o.id = _org_id;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'unknown_workspace';
  END IF;
  IF v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not_workspace_owner';
  END IF;
  IF v_kind = 'school' AND v_role IS DISTINCT FROM 'school' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF v_kind = 'teacher' AND v_role IS DISTINCT FROM 'teacher' THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF v_kind NOT IN ('school', 'teacher') THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = _building_id
      AND (b.owner_id = v_uid OR b.org_id = _org_id)
  ) THEN
    RAISE EXCEPTION 'not_your_building';
  END IF;

  INSERT INTO public.workspace_building_selection (org_id, building_id, set_by)
  VALUES (_org_id, _building_id, v_uid)
  ON CONFLICT (org_id) DO UPDATE
    SET building_id = EXCLUDED.building_id,
        set_by = EXCLUDED.set_by,
        updated_at = now();

  UPDATE public.buildings
  SET is_active = false
  WHERE org_id = _org_id
    AND id <> _building_id;
  UPDATE public.buildings SET is_active = true WHERE id = _building_id;

  RETURN jsonb_build_object('scope', 'workspace', 'orgId', _org_id, 'buildingId', _building_id);
END;
$$;

REVOKE ALL ON FUNCTION public.select_displayed_building(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_displayed_building(uuid, uuid, text) TO authenticated, service_role;

-- The building on screen for this caller. Security definer so a viewer can
-- read the chosen face without being a member of the owner's building row.
CREATE OR REPLACE FUNCTION public.get_resolved_building(
  _org_id uuid DEFAULT NULL,
  _audience text DEFAULT NULL,
  _owner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_building_admin(v_uid);
  v_public boolean := _audience = 'public-free' OR v_uid IS NULL;
  v_preview text := NULL;
  v_tier text;
  v_kind text;
  v_owner uuid;
  v_ws uuid;
  v_pro uuid;
  v_free uuid;
  v_building uuid;
  v_source text;
  v_slot text;
  v_explicit boolean := false;
  v_can_change boolean := false;
  v_can_edit boolean := false;
  v_config jsonb := '{}'::jsonb;
  v_name text := NULL;
BEGIN
  IF _audience = 'preview-free' AND v_admin THEN
    v_preview := 'free';
  ELSIF _audience = 'preview-pro' AND v_admin THEN
    v_preview := 'pro';
  END IF;

  IF v_public OR v_preview = 'free' THEN
    v_tier := 'free';
  ELSIF v_preview = 'pro' THEN
    v_tier := 'pro';
  ELSE
    v_tier := public.building_tier_of(v_uid);
  END IF;

  -- A student entering a teacher's workspace knows the teacher, not always
  -- the teacher's organisation. Resolve that teacher's own workspace.
  IF _org_id IS NULL AND _owner_id IS NOT NULL THEN
    SELECT o.id INTO _org_id
    FROM public.organizations o
    WHERE o.owner_user_id = _owner_id
      AND o.kind IN ('school', 'teacher')
    ORDER BY CASE WHEN o.kind = 'school' THEN 0 ELSE 1 END, o.created_at
    LIMIT 1;
  END IF;

  IF _org_id IS NOT NULL THEN
    SELECT o.kind, o.owner_user_id INTO v_kind, v_owner
    FROM public.organizations o
    WHERE o.id = _org_id;
  END IF;

  IF NOT v_public AND v_preview IS NULL AND v_kind IN ('school', 'teacher') THEN
    IF v_kind = 'school' OR public.building_tier_of(v_owner) = 'pro' THEN
      SELECT w.building_id INTO v_ws
      FROM public.workspace_building_selection w
      WHERE w.org_id = _org_id;
    END IF;
  END IF;

  IF v_ws IS NOT NULL THEN
    v_building := v_ws;
    v_source := 'workspace';
    v_slot := 'pro';
    v_explicit := true;
  ELSE
    SELECT s.pro_building_id, s.free_building_id INTO v_pro, v_free
    FROM public.platform_building_selection s
    WHERE s.id IS TRUE;

    IF v_tier = 'free' AND v_free IS NOT NULL THEN
      v_building := v_free;
      v_source := 'owner-free';
      v_slot := 'free';
      v_explicit := true;
    ELSIF v_pro IS NOT NULL THEN
      v_building := v_pro;
      v_source := 'owner-pro';
      v_slot := 'pro';
      v_explicit := v_tier = 'pro';
    ELSE
      v_building := NULL;
      v_source := CASE WHEN v_tier = 'free' THEN 'owner-free' ELSE 'owner-pro' END;
      v_slot := 'pro';
      v_explicit := false;
      SELECT p.homepage_config INTO v_config
      FROM public.profiles p
      JOIN public.user_roles r ON r.user_id = p.user_id AND r.role = 'platform_owner'
      WHERE COALESCE(p.homepage_config, '{}'::jsonb) <> '{}'::jsonb
      LIMIT 1;
    END IF;
  END IF;

  IF v_building IS NOT NULL THEN
    SELECT COALESCE(b.exterior_config, '{}'::jsonb), b.name
      INTO v_config, v_name
    FROM public.buildings b
    WHERE b.id = v_building;
  END IF;
  v_config := COALESCE(v_config, '{}'::jsonb);

  IF v_public OR v_uid IS NULL THEN
    v_can_change := false;
  ELSIF v_admin THEN
    v_can_change := true;
  ELSIF public.account_role_of(v_uid) = 'student' THEN
    v_can_change := false;
  ELSIF public.building_tier_of(v_uid) = 'free' THEN
    v_can_change := false;
  ELSIF public.account_role_of(v_uid) = 'school'
    AND v_kind = 'school'
    AND public.is_org_owner(_org_id) THEN
    v_can_change := true;
  ELSIF public.account_role_of(v_uid) = 'teacher'
    AND public.building_tier_of(v_uid) = 'pro'
    AND v_kind = 'teacher'
    AND public.is_org_owner(_org_id) THEN
    v_can_change := true;
  END IF;

  v_can_edit := v_can_change AND v_explicit AND (
    v_source = 'workspace' OR v_admin
  );

  RETURN jsonb_build_object(
    'buildingId', v_building,
    'name', v_name,
    'config', v_config,
    'source', v_source,
    'tier', v_tier,
    'slotVersion', v_slot,
    'explicit', v_explicit,
    'canChange', v_can_change,
    'canEdit', v_can_edit,
    'adsEnabled', v_source IS DISTINCT FROM 'workspace' AND v_tier = 'free',
    'isAdmin', v_admin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_resolved_building(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_resolved_building(uuid, text, uuid) TO anon, authenticated, service_role;

-- Artwork for the building on screen lives in the owner's private folder.
-- Without this, other people can read the selection and still paint the
-- shipped artwork, because signing the file is refused.
CREATE OR REPLACE FUNCTION public.resolved_building_references_asset(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _name IS NOT NULL
    AND length(_name) > 8
    AND (
      EXISTS (
        SELECT 1
        FROM (
          SELECT b.exterior_config AS face
          FROM public.platform_building_selection s
          JOIN public.buildings b ON b.id = s.pro_building_id OR b.id = s.free_building_id
          UNION ALL
          SELECT b.exterior_config
          FROM public.workspace_building_selection w
          JOIN public.buildings b ON b.id = w.building_id
        ) faces
        WHERE strpos(faces.face::text, _name) > 0
      )
      OR (
        NOT EXISTS (
          SELECT 1 FROM public.platform_building_selection s
          WHERE s.pro_building_id IS NOT NULL OR s.free_building_id IS NOT NULL
        )
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          JOIN public.user_roles r ON r.user_id = p.user_id AND r.role = 'platform_owner'
          WHERE strpos(COALESCE(p.homepage_config, '{}'::jsonb)::text, _name) > 0
        )
      )
    )
$$;

REVOKE ALL ON FUNCTION public.resolved_building_references_asset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolved_building_references_asset(text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Resolved building artwork is readable" ON storage.objects;
CREATE POLICY "Resolved building artwork is readable"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'game-assets'
    AND public.resolved_building_references_asset(name)
  );
