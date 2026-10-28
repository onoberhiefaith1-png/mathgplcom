CREATE TABLE public.floating_display_settings (
  id boolean NOT NULL PRIMARY KEY DEFAULT true,
  style text NOT NULL DEFAULT 'original',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT floating_display_settings_singleton CHECK (id)
);

GRANT SELECT ON public.floating_display_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.floating_display_settings TO authenticated;
GRANT ALL ON public.floating_display_settings TO service_role;

ALTER TABLE public.floating_display_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the platform floating display default"
  ON public.floating_display_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can set the platform floating display default"
  ON public.floating_display_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE POLICY "Admins can update the platform floating display default"
  ON public.floating_display_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

INSERT INTO public.floating_display_settings (id, style) VALUES (true, 'original')
  ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.user_display_preferences (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  floating_display_style text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_display_preferences TO authenticated;
GRANT ALL ON public.user_display_preferences TO service_role;

ALTER TABLE public.user_display_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "People manage their own display preferences"
  ON public.user_display_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_display_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_floating_display_settings_updated_at
  BEFORE UPDATE ON public.floating_display_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_display_settings();

CREATE TRIGGER update_user_display_preferences_updated_at
  BEFORE UPDATE ON public.user_display_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_display_settings();