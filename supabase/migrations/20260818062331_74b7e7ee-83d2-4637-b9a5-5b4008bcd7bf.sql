-- Official GPL Asset library: Session -> Sub-Session -> Asset

CREATE OR REPLACE FUNCTION public.can_manage_gpl_assets()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'platform_owner'::app_role)
$$;

CREATE TABLE public.gpl_asset_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gpl_asset_sessions TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.gpl_asset_sessions TO authenticated;
GRANT ALL ON public.gpl_asset_sessions TO service_role;
ALTER TABLE public.gpl_asset_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gpl_sessions_read_active" ON public.gpl_asset_sessions
  FOR SELECT USING (is_active OR public.can_manage_gpl_assets());
CREATE POLICY "gpl_sessions_manage" ON public.gpl_asset_sessions
  FOR ALL TO authenticated
  USING (public.can_manage_gpl_assets())
  WITH CHECK (public.can_manage_gpl_assets());

CREATE TABLE public.gpl_asset_subsessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.gpl_asset_sessions(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, slug)
);

GRANT SELECT ON public.gpl_asset_subsessions TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.gpl_asset_subsessions TO authenticated;
GRANT ALL ON public.gpl_asset_subsessions TO service_role;
ALTER TABLE public.gpl_asset_subsessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gpl_subsessions_read_active" ON public.gpl_asset_subsessions
  FOR SELECT USING (is_active OR public.can_manage_gpl_assets());
CREATE POLICY "gpl_subsessions_manage" ON public.gpl_asset_subsessions
  FOR ALL TO authenticated
  USING (public.can_manage_gpl_assets())
  WITH CHECK (public.can_manage_gpl_assets());

CREATE TABLE public.gpl_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subsession_id uuid NOT NULL REFERENCES public.gpl_asset_subsessions(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  asset_type text NOT NULL DEFAULT 'image',
  storage_path text,
  external_url text,
  glyph text,
  media_type text NOT NULL DEFAULT 'image',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subsession_id, slug)
);

GRANT SELECT ON public.gpl_assets TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.gpl_assets TO authenticated;
GRANT ALL ON public.gpl_assets TO service_role;
ALTER TABLE public.gpl_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gpl_assets_read_active" ON public.gpl_assets
  FOR SELECT USING (is_active OR public.can_manage_gpl_assets());
CREATE POLICY "gpl_assets_manage" ON public.gpl_assets
  FOR ALL TO authenticated
  USING (public.can_manage_gpl_assets())
  WITH CHECK (public.can_manage_gpl_assets());

CREATE INDEX gpl_subsessions_session_idx ON public.gpl_asset_subsessions (session_id, sort_order);
CREATE INDEX gpl_assets_subsession_idx ON public.gpl_assets (subsession_id, sort_order);

CREATE TABLE public.gpl_asset_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.gpl_assets(id) ON DELETE CASCADE,
  surface text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, surface)
);

GRANT SELECT ON public.gpl_asset_usage TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.gpl_asset_usage TO authenticated;
GRANT ALL ON public.gpl_asset_usage TO service_role;
ALTER TABLE public.gpl_asset_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gpl_usage_read" ON public.gpl_asset_usage
  FOR SELECT USING (true);
CREATE POLICY "gpl_usage_manage" ON public.gpl_asset_usage
  FOR ALL TO authenticated
  USING (public.can_manage_gpl_assets())
  WITH CHECK (public.can_manage_gpl_assets());

CREATE TRIGGER gpl_asset_sessions_touch_updated_at
  BEFORE UPDATE ON public.gpl_asset_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER gpl_asset_subsessions_touch_updated_at
  BEFORE UPDATE ON public.gpl_asset_subsessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER gpl_assets_touch_updated_at
  BEFORE UPDATE ON public.gpl_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();