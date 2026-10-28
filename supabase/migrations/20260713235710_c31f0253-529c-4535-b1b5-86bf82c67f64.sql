
CREATE TABLE public.game_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('background','reward','progress_bar','effect')),
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  title text NOT NULL DEFAULT 'Untitled',
  storage_path text NOT NULL,
  processed_path text,
  processed_status text NOT NULL DEFAULT 'none' CHECK (processed_status IN ('none','pending','done','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_assets TO authenticated;
GRANT ALL ON public.game_assets TO service_role;
ALTER TABLE public.game_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their game assets" ON public.game_assets
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Game',
  topic text,
  subtopic text,
  thumbnail_path text,
  canvas jsonb NOT NULL DEFAULT '{"scenes":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their games" ON public.games
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.class_games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, game_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_games TO authenticated;
GRANT ALL ON public.class_games TO service_role;
ALTER TABLE public.class_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class members view class games" ON public.class_games
  FOR SELECT USING (private.is_class_owner(class_id) OR private.is_class_member(class_id));
CREATE POLICY "Class owner manages class games" ON public.class_games
  FOR ALL USING (private.is_class_owner(class_id)) WITH CHECK (private.is_class_owner(class_id));

CREATE TABLE public.class_game_boards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  progress_element_id text NOT NULL,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, game_id, progress_element_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_game_boards TO authenticated;
GRANT ALL ON public.class_game_boards TO service_role;
ALTER TABLE public.class_game_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class owner manages game boards" ON public.class_game_boards
  FOR ALL TO authenticated
  USING (private.is_class_owner(class_id)) WITH CHECK (private.is_class_owner(class_id));
CREATE POLICY "Class members view game boards" ON public.class_game_boards
  FOR SELECT TO authenticated
  USING (private.is_class_owner(class_id) OR private.is_class_member(class_id));

CREATE TRIGGER trg_game_assets_updated BEFORE UPDATE ON public.game_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_games_updated BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Teachers read own game files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'game-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Teachers upload own game files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Teachers update own game files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'game-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Teachers delete own game files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'game-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
