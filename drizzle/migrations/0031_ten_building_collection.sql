-- Mirror of supabase/migrations/20261118120000_ten_building_collection.sql
-- Ten-building collection installer. Not applied to the live database by this change.
-- Numbered 0031 because 0030_academia_evaluation_tier_scores.sql owns 0030.
-- Hand-written, like 0022–0030: not a drizzle-kit snapshot and not a journal entry.
--
-- TEN-BUILDING COLLECTION — one atomic, repeat-safe install for administrators.
--
-- For each of the ten blueprints (sent by the app, validated here) this:
--   1. creates the administrator's own editable building (Mine), inactive;
--   2. creates a frozen, inactive gallery template copy, exactly like
--      publishBuildingToGallery's clone ("<name> (gallery template)");
--   3. publishes ONE official (Public) gallery entry pointing at that template.
-- Every row id is derived deterministically, so a retry or double click finds
-- the rows it already made instead of adding duplicates. Everything runs in
-- one transaction: any error rolls the whole collection back.
--
-- No existing building, active selection, homepage config or Free/Pro default
-- is read for writing or changed: only INSERTs of new rows.

CREATE OR REPLACE FUNCTION public.collection_insert_building_structure(_building uuid, _owner uuid, _t jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  h jsonb; r jsonb; w uuid; d uuid; c uuid; hallway_ids jsonb := '{}'::jsonb; n integer := 0;
BEGIN
  FOR h IN SELECT value FROM jsonb_array_elements(_t->'hallways') LOOP
    IF h->>'parent' IS NOT NULL AND hallway_ids->>(h->>'parent') IS NULL THEN
      RAISE EXCEPTION 'A hallway has no connected parent.';
    END IF;
    IF NOT (h->>'direction' = ANY (ARRAY['forward','left','right'])) THEN
      RAISE EXCEPTION 'Unknown hallway direction.';
    END IF;
    INSERT INTO public.building_walkways (building_id, parent_id, name, end_label, direction, junction_at, length, position)
    VALUES (_building, (hallway_ids->>(h->>'parent'))::uuid, h->>'name', h->>'end', h->>'direction',
            (h->>'junction')::numeric, (h->>'length')::real, n)
    RETURNING id INTO w;
    hallway_ids := hallway_ids || jsonb_build_object(h->>'key', w);
    n := n + 1;
  END LOOP;

  n := 0;
  FOR r IN SELECT value FROM jsonb_array_elements(_t->'rooms') LOOP
    w := (hallway_ids->>(r->>'hallway'))::uuid;
    IF w IS NULL THEN RAISE EXCEPTION 'A room is not connected to a hallway.'; END IF;
    INSERT INTO public.building_doors (building_id, walkway_id, position_along, design, title_override, created_by)
    VALUES (_building, w, (r->>'offset')::real, _t->'environment'->'door', r->>'name', _owner)
    RETURNING id INTO d;
    INSERT INTO public.building_classrooms (building_id, door_id, name, kind, position)
    VALUES (_building, d, r->>'name', r->>'kind', n)
    RETURNING id INTO c;
    INSERT INTO public.building_room_screens (building_id, classroom_id) VALUES (_building, c);
    INSERT INTO public.building_frames (building_id, classroom_id, wall, kind, design, name, offset_along, offset_y, width, height_ratio)
    VALUES (_building, c, 'leftWall', 'frame', _t->>'frameDesign', (r->>'name') || ' Assignments', 0.3, 2.1, 1.6, 0.66),
           (_building, c, 'rightWall', 'frame', _t->>'frameDesign', (r->>'name') || ' Adventures', 0.7, 2.1, 1.6, 0.66);
    n := n + 1;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.collection_insert_building_structure(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collection_insert_building_structure(uuid, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.install_building_collection_for_owner(_owner_id uuid, _templates jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := _owner_id;
  t jsonb; b uuid; tpl uuid; e uuid; existing_owner uuid;
  made boolean; tpl_made boolean; published_now boolean;
  slugs text[] := ARRAY['nile-sun-palace','aegean-academy','andalusian-courtyard','meridian-dome-palace',
                        'heritage-clock-hall','glass-garden-campus','horizon-sails-institute',
                        'aurora-sky-academy','verdant-arcology','celestial-observatory'];
  result jsonb := '[]'::jsonb;
BEGIN
  IF uid IS NULL OR NOT (
    coalesce(public.has_role(uid, 'platform_owner'), false) OR
    coalesce(public.has_role(uid, 'co_admin'), false)
  ) THEN
    RAISE EXCEPTION 'Only building administrators can install the collection.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_templates) IS DISTINCT FROM 'array' OR jsonb_array_length(_templates) <> 10 THEN
    RAISE EXCEPTION 'The complete ten-building collection is required.';
  END IF;
  IF (SELECT count(DISTINCT value->>'slug') FROM jsonb_array_elements(_templates)) <> 10 THEN
    RAISE EXCEPTION 'Each collection building must be unique.';
  END IF;

  -- One install at a time across all administrators (the Public entries are
  -- shared), so double clicks and retries serialize instead of racing.
  PERFORM pg_advisory_xact_lock(hashtextextended('building-collection-v1', 0));

  FOR t IN SELECT value FROM jsonb_array_elements(_templates) LOOP
    IF NOT (t->>'slug' = ANY (slugs)) THEN RAISE EXCEPTION 'Unknown collection building.'; END IF;
    IF jsonb_array_length(t->'hallways') <> 7 OR jsonb_array_length(t->'rooms') <> 11 THEN
      RAISE EXCEPTION 'Incomplete building structure.';
    END IF;
    IF jsonb_typeof(t->'environment') IS DISTINCT FROM 'object' OR jsonb_typeof(t->'exterior') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Incomplete building design.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.building_gallery_categories WHERE slug = t->>'category') THEN
      RAISE EXCEPTION 'Unknown gallery category %.', t->>'category';
    END IF;

    -- 1. The administrator's own editable copy.
    b := md5('building-collection-v1:' || uid::text || ':' || (t->>'slug'))::uuid;
    SELECT owner_id INTO existing_owner FROM public.buildings WHERE id = b;
    made := NOT FOUND;
    IF NOT made AND existing_owner <> uid THEN RAISE EXCEPTION 'Building identity conflict.'; END IF;
    IF made THEN
      INSERT INTO public.buildings (id, owner_id, org_id, name, environment, exterior_config, thumbnail_url, is_active)
      VALUES (b, uid, NULL, t->>'name', t->'environment', t->'exterior', t->>'thumbnail', false);
      PERFORM public.collection_insert_building_structure(b, uid, t);
    END IF;

    -- 2. The frozen template behind the Public entry (shared, made once).
    tpl := md5('building-collection-v1-template:' || (t->>'slug'))::uuid;
    tpl_made := NOT EXISTS (SELECT 1 FROM public.buildings WHERE id = tpl);
    IF tpl_made THEN
      INSERT INTO public.buildings (id, owner_id, org_id, name, source_building_id, environment, exterior_config, thumbnail_url, is_active)
      VALUES (tpl, uid, NULL, (t->>'name') || ' (gallery template)', b, t->'environment', t->'exterior', t->>'thumbnail', false);
      PERFORM public.collection_insert_building_structure(tpl, uid, t);
    END IF;

    -- 3. One official gallery entry per building, ever.
    e := md5('building-collection-v1-entry:' || (t->>'slug'))::uuid;
    published_now := NOT EXISTS (SELECT 1 FROM public.building_gallery_entries WHERE id = e);
    IF published_now THEN
      INSERT INTO public.building_gallery_entries
        (id, kind, name, description, category_slug, template_building_id, publisher_id, published, exterior_config, exterior_thumbnail)
      VALUES (e, 'official', t->>'name', t->>'description', t->>'category', tpl, uid, true, t->'exterior', t->>'thumbnail');
    END IF;

    result := result || jsonb_build_array(jsonb_build_object(
      'slug', t->>'slug', 'name', t->>'name',
      'buildingId', b, 'created', made,
      'templateId', tpl, 'templateCreated', tpl_made,
      'entryId', e, 'published', published_now));
  END LOOP;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.install_building_collection_for_owner(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.install_building_collection_for_owner(uuid, jsonb) TO service_role;

-- Browser-reachable entry point: the caller can only install for themselves,
-- and only when they are an administrator.
CREATE OR REPLACE FUNCTION public.install_building_collection(_templates jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    coalesce(public.has_role(auth.uid(), 'platform_owner'), false) OR
    coalesce(public.has_role(auth.uid(), 'co_admin'), false)
  ) THEN
    RAISE EXCEPTION 'Only building administrators can install the collection.' USING ERRCODE = '42501';
  END IF;
  RETURN public.install_building_collection_for_owner(auth.uid(), _templates);
END;
$$;
REVOKE ALL ON FUNCTION public.install_building_collection(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.install_building_collection(jsonb) TO authenticated;
