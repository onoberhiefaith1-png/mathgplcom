ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS exterior_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

UPDATE public.buildings b
SET exterior_config = COALESCE(p.homepage_config, '{}'::jsonb)
FROM public.profiles p
WHERE p.user_id = b.owner_id
  AND b.exterior_config = '{}'::jsonb
  AND p.homepage_config IS NOT NULL;