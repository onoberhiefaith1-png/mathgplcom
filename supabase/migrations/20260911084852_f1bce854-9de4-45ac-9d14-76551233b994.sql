CREATE TABLE public.quick_action_placement (
  key TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
  x_pct NUMERIC NOT NULL DEFAULT 4,
  y_pct NUMERIC NOT NULL DEFAULT 92,
  updated_by UUID REFERENCES auth.users,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quick_action_placement TO anon;
GRANT SELECT, INSERT, UPDATE ON public.quick_action_placement TO authenticated;
GRANT ALL ON public.quick_action_placement TO service_role;

ALTER TABLE public.quick_action_placement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quick action placement is readable by everyone"
  ON public.quick_action_placement FOR SELECT
  USING (true);

CREATE POLICY "Platform owner can create quick action placement"
  ON public.quick_action_placement FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));

CREATE POLICY "Platform owner can move quick action placement"
  ON public.quick_action_placement FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner'));

CREATE TRIGGER update_quick_action_placement_updated_at
  BEFORE UPDATE ON public.quick_action_placement
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.quick_action_placement (key, x_pct, y_pct) VALUES ('global', 4, 92);