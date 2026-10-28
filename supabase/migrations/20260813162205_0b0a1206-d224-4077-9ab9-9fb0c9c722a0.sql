CREATE TABLE public.building_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  version TEXT NOT NULL DEFAULT 'pro',
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_assets TO authenticated;
GRANT ALL ON public.building_assets TO service_role;

ALTER TABLE public.building_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their building assets"
ON public.building_assets FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Platform owner manages free building assets"
ON public.building_assets FOR ALL TO authenticated
USING (version = 'free' AND public.has_role(auth.uid(), 'platform_owner'))
WITH CHECK (version = 'free' AND public.has_role(auth.uid(), 'platform_owner'));

CREATE INDEX building_assets_owner_created_idx
  ON public.building_assets (owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_building_assets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_building_assets_updated_at
BEFORE UPDATE ON public.building_assets
FOR EACH ROW EXECUTE FUNCTION public.touch_building_assets_updated_at();