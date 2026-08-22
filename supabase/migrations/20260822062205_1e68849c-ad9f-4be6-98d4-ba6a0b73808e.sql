CREATE TABLE public.archived_features (
  feature_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.archived_features TO authenticated;
GRANT INSERT, UPDATE ON public.archived_features TO authenticated;
GRANT SELECT ON public.archived_features TO anon;
GRANT ALL ON public.archived_features TO service_role;

ALTER TABLE public.archived_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read archived features"
  ON public.archived_features FOR SELECT
  USING (true);

CREATE POLICY "Admins can add archived features"
  ON public.archived_features FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE POLICY "Admins can change archived features"
  ON public.archived_features FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE OR REPLACE FUNCTION public.archived_features_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER archived_features_updated_at
  BEFORE UPDATE ON public.archived_features
  FOR EACH ROW EXECUTE FUNCTION public.archived_features_touch();

INSERT INTO public.archived_features (feature_key, display_name, archived)
VALUES ('floating_number_ai', 'Floating Number AI', true);