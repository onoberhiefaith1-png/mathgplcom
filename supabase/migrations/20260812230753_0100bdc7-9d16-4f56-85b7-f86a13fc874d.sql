UPDATE public.gateway_plans
SET items = (
  SELECT array_agg(DISTINCT x)
  FROM unnest(
    array_remove(items, 'courses') || ARRAY['course_video_link','course_premium_video']
  ) AS x
)
WHERE 'courses' = ANY(items);

UPDATE public.gateway_entitlements
SET granted_items = (
  SELECT array_agg(DISTINCT x)
  FROM unnest(
    array_remove(granted_items, 'courses') || ARRAY['course_video_link','course_premium_video']
  ) AS x
)
WHERE 'courses' = ANY(granted_items);