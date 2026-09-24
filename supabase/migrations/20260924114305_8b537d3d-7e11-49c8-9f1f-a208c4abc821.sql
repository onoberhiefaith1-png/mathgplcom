-- A student's own Content Margin for a Game's writing surfaces.
-- The teacher's saved design is never affected by this row.

CREATE TABLE IF NOT EXISTS public.slate_surface_margins (
  user_id uuid NOT NULL,
  game_id uuid NOT NULL,
  content_margin numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slate_surface_margins TO authenticated;
GRANT ALL ON public.slate_surface_margins TO service_role;

ALTER TABLE public.slate_surface_margins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own margin is readable"
  ON public.slate_surface_margins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Own margin is writable"
  ON public.slate_surface_margins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own margin is updatable"
  ON public.slate_surface_margins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own margin is removable"
  ON public.slate_surface_margins FOR DELETE TO authenticated
  USING (auth.uid() = user_id);