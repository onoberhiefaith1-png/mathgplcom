-- 1. Community creator identity ------------------------------------------------
CREATE TABLE public.community_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX community_profiles_username_key ON public.community_profiles (lower(username));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_profiles TO authenticated;
GRANT ALL ON public.community_profiles TO service_role;
ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community profiles are readable by members"
  ON public.community_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members manage their own community profile"
  ON public.community_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members update their own community profile"
  ON public.community_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage community profiles"
  ON public.community_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 2. Published resources --------------------------------------------------------
CREATE TABLE public.community_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('lesson_note','class','adventure','background','building','asset')),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  hashtags text[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_id uuid,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','unpublished','removed')),
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_resources_kind_status_idx ON public.community_resources (kind, status, published_at DESC);
CREATE INDEX community_resources_owner_idx ON public.community_resources (owner_id);
CREATE INDEX community_resources_hashtags_idx ON public.community_resources USING gin (hashtags);
CREATE UNIQUE INDEX community_resources_source_key ON public.community_resources (kind, source_id) WHERE source_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_resources TO authenticated;
GRANT ALL ON public.community_resources TO service_role;
ALTER TABLE public.community_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published resources are readable by members"
  ON public.community_resources FOR SELECT TO authenticated
  USING (status = 'published' OR owner_id = auth.uid()
         OR public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
CREATE POLICY "Members publish their own resources"
  ON public.community_resources FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Members update their own resources"
  ON public.community_resources FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Members delete their own resources"
  ON public.community_resources FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Admins manage every community resource"
  ON public.community_resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 3. Likes ----------------------------------------------------------------------
CREATE TABLE public.community_likes (
  resource_id uuid NOT NULL REFERENCES public.community_resources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_likes TO authenticated;
GRANT ALL ON public.community_likes TO service_role;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are readable by members"
  ON public.community_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members add their own like"
  ON public.community_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members remove their own like"
  ON public.community_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4. Downloads (active-copy tracking) ------------------------------------------
CREATE TABLE public.community_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.community_resources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  copy_id uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_downloads_resource_idx ON public.community_downloads (resource_id) WHERE revoked_at IS NULL;
CREATE INDEX community_downloads_user_idx ON public.community_downloads (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_downloads TO authenticated;
GRANT ALL ON public.community_downloads TO service_role;
ALTER TABLE public.community_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Downloads are readable by members"
  ON public.community_downloads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members record their own download"
  ON public.community_downloads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members update their own download"
  ON public.community_downloads FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members delete their own download"
  ON public.community_downloads FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5. Moderation reports ---------------------------------------------------------
CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.community_resources(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own reports"
  ON public.community_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY "Members file reports"
  ON public.community_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admins moderate reports"
  ON public.community_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 6. Card view: resource + creator + counts ------------------------------------
CREATE VIEW public.community_resource_cards
WITH (security_invoker = true) AS
SELECT r.id, r.kind, r.owner_id, r.title, r.description, r.hashtags, r.payload,
       r.source_id, r.status, r.published_at, r.created_at, r.updated_at,
       p.username,
       (SELECT count(*) FROM public.community_likes l WHERE l.resource_id = r.id) AS like_count,
       (SELECT count(*) FROM public.community_downloads d
          WHERE d.resource_id = r.id AND d.revoked_at IS NULL) AS active_downloads
FROM public.community_resources r
LEFT JOIN public.community_profiles p ON p.user_id = r.owner_id;

GRANT SELECT ON public.community_resource_cards TO authenticated;
GRANT ALL ON public.community_resource_cards TO service_role;

-- 7. Classes can be shared with the Community ----------------------------------
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS community_shared boolean NOT NULL DEFAULT false;

-- 8. updated_at triggers --------------------------------------------------------
CREATE TRIGGER community_profiles_updated_at BEFORE UPDATE ON public.community_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER community_resources_updated_at BEFORE UPDATE ON public.community_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER community_reports_updated_at BEFORE UPDATE ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();