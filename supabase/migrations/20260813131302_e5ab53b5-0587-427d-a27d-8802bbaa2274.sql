ALTER TABLE public.platform_building_default
  ADD COLUMN IF NOT EXISTS free_building jsonb;

CREATE TABLE IF NOT EXISTS public.platform_advertisements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot smallint NOT NULL UNIQUE CHECK (slot BETWEEN 1 AND 8),
  media_path text,
  media_source text NOT NULL DEFAULT 'storage',
  media_type text NOT NULL DEFAULT 'image',
  label text,
  is_active boolean NOT NULL DEFAULT true,
  duration_ms integer NOT NULL DEFAULT 6000,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_advertisements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_advertisements TO authenticated;
GRANT ALL ON public.platform_advertisements TO service_role;

ALTER TABLE public.platform_advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active advertisements"
  ON public.platform_advertisements
  FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'platform_owner'::app_role) OR has_role(auth.uid(), 'co_admin'::app_role));

CREATE POLICY "Platform owners manage advertisements"
  ON public.platform_advertisements
  FOR ALL
  USING (has_role(auth.uid(), 'platform_owner'::app_role) OR has_role(auth.uid(), 'co_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_owner'::app_role) OR has_role(auth.uid(), 'co_admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_platform_advertisements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_platform_advertisements ON public.platform_advertisements;
CREATE TRIGGER touch_platform_advertisements
  BEFORE UPDATE ON public.platform_advertisements
  FOR EACH ROW EXECUTE FUNCTION public.touch_platform_advertisements();

CREATE OR REPLACE FUNCTION public.set_platform_free_building(_config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT (has_role(auth.uid(), 'platform_owner'::app_role) OR has_role(auth.uid(), 'co_admin'::app_role)) THEN
    RAISE EXCEPTION 'Only the platform owner can edit the Free building';
  END IF;

  INSERT INTO public.platform_building_default (id, free_building, updated_by)
  VALUES (true, _config, auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET free_building = _config,
        updated_by = auth.uid(),
        updated_at = now()
  RETURNING free_building INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_free_building(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_platform_free_building(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_free_building()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT free_building FROM public.platform_building_default WHERE id = true;
$$;

REVOKE ALL ON FUNCTION public.get_platform_free_building() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_free_building() TO anon, authenticated, service_role;