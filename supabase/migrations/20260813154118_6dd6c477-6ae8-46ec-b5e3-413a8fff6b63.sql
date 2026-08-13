-- Website content management for the public homepage
CREATE TABLE public.site_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  kind text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  eyebrow text,
  headline text,
  subline text,
  cta_label text,
  cta_href text,
  media jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  draft jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_sections TO authenticated;
GRANT ALL ON public.site_sections TO service_role;

ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published sections"
ON public.site_sections FOR SELECT
TO anon, authenticated
USING (published_at IS NOT NULL OR public.has_role(auth.uid(), 'platform_owner'));

CREATE POLICY "Platform owner manages sections"
ON public.site_sections FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner'))
WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));

CREATE TABLE public.site_testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_name text NOT NULL,
  author_role text,
  organisation text,
  quote text NOT NULL,
  avatar jsonb,
  approved boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_testimonials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_testimonials TO authenticated;
GRANT ALL ON public.site_testimonials TO service_role;

ALTER TABLE public.site_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved testimonials"
ON public.site_testimonials FOR SELECT
TO anon, authenticated
USING (approved OR public.has_role(auth.uid(), 'platform_owner'));

CREATE POLICY "Platform owner manages testimonials"
ON public.site_testimonials FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner'))
WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));

CREATE TABLE public.site_stats_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  show_learners boolean NOT NULL DEFAULT false,
  show_teachers boolean NOT NULL DEFAULT false,
  show_schools boolean NOT NULL DEFAULT false,
  show_questions boolean NOT NULL DEFAULT false,
  show_adventures boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_stats_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.site_stats_settings TO authenticated;
GRANT ALL ON public.site_stats_settings TO service_role;

ALTER TABLE public.site_stats_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stats settings"
ON public.site_stats_settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Platform owner manages stats settings"
ON public.site_stats_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner'))
WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));

INSERT INTO public.site_stats_settings (id) VALUES (gen_random_uuid());

CREATE OR REPLACE FUNCTION public.site_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER site_sections_updated_at
BEFORE UPDATE ON public.site_sections
FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

CREATE TRIGGER site_testimonials_updated_at
BEFORE UPDATE ON public.site_testimonials
FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

CREATE TRIGGER site_stats_settings_updated_at
BEFORE UPDATE ON public.site_stats_settings
FOR EACH ROW EXECUTE FUNCTION public.site_touch_updated_at();

-- Aggregate-only public statistics (no rows, no personal data)
CREATE OR REPLACE FUNCTION public.get_site_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'learners', (SELECT count(*) FROM public.user_roles WHERE role = 'student'),
    'teachers', (SELECT count(*) FROM public.user_roles WHERE role = 'teacher'),
    'schools', (SELECT count(*) FROM public.organizations),
    'questions', (SELECT count(*) FROM public.smart_card_attempts),
    'adventures', (SELECT count(*) FROM public.video_adventure_runs)
  )
$$;

REVOKE ALL ON FUNCTION public.get_site_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_stats() TO anon, authenticated, service_role;

-- Seed the 13-section homepage journey (text only; media added by the owner)
INSERT INTO public.site_sections (key, kind, position, visible, eyebrow, headline, subline, cta_label, cta_href, published_at)
VALUES
  ('hook', 'hero', 1, true, 'MathGPL', 'Mathematics, Reimagined.', 'Learn. Explore. Solve. Experience mathematics differently.', 'Get Started', '/signup', now()),
  ('curiosity', 'statement', 2, true, NULL, 'This isn''t just another way to learn mathematics.', NULL, NULL, NULL, now()),
  ('product', 'video', 3, true, NULL, 'See it moving.', NULL, NULL, NULL, now()),
  ('what', 'panels', 4, true, NULL, 'One platform. A completely different mathematics experience.', NULL, NULL, NULL, now()),
  ('platform', 'showcase', 5, true, NULL, 'See MathGPL in action.', NULL, 'Explore MathGPL', '/signup', now()),
  ('world', 'cinematic', 6, true, NULL, 'Where mathematics becomes an experience.', NULL, NULL, NULL, now()),
  ('transformation', 'compare', 7, true, NULL, 'From mathematics on the page…', '…to mathematics you can experience.', NULL, NULL, now()),
  ('numbers', 'stats', 8, true, NULL, 'MathGPL at a glance', NULL, NULL, NULL, now()),
  ('audience', 'audience', 9, true, NULL, 'One platform. Different journeys.', NULL, 'Start Your Journey', '/signup', now()),
  ('proof', 'testimonials', 10, true, NULL, 'Built for people who believe mathematics can be more.', NULL, NULL, NULL, now()),
  ('experience', 'demo', 11, true, NULL, 'Mathematics beyond the page.', NULL, 'Join MathGPL', '/signup', now()),
  ('final', 'cta', 12, true, NULL, 'The future of mathematics learning starts here.', 'Learn it. Solve it. Explore it.', 'Get Started', '/signup', now()),
  ('footer', 'footer', 13, true, NULL, NULL, NULL, NULL, NULL, now());