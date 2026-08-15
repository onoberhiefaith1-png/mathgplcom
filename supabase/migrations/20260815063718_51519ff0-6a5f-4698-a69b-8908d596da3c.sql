UPDATE public.platform_building_default
SET free_building = jsonb_build_object('buildingMode', 'mathgpl'),
    updated_at = now()
WHERE id = true;