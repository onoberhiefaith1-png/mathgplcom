-- 1. Owner-linked accounts manage tutorials too.
CREATE OR REPLACE FUNCTION public.can_manage_tutorials()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select public.has_capability('platform_admin')
     or exists (select 1 from public.asset_managers m where m.user_id = auth.uid())
     or exists (
       select 1
       from public.platform_test_accounts t
       where t.target_user_id = auth.uid()
         and (
           public.has_role(t.owner_user_id, 'platform_owner'::app_role)
           or public.has_role(t.owner_user_id, 'co_admin'::app_role)
         )
     )
$function$;

-- 2. A tutorial may be an uploaded video OR a link.
ALTER TABLE public.page_guide_videos
  ADD COLUMN IF NOT EXISTS link_url text;
ALTER TABLE public.page_guide_videos
  ALTER COLUMN video_path DROP NOT NULL;
ALTER TABLE public.page_guide_videos
  ADD CONSTRAINT page_guide_videos_source_present
  CHECK (
    (video_path IS NOT NULL AND link_url IS NULL)
    OR (video_path IS NULL AND link_url IS NOT NULL)
  );

-- 3. Where the tutorial buttons sit, shared by every account.
CREATE TABLE public.page_guide_placement (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_key text NOT NULL UNIQUE,
  x_pct numeric NOT NULL DEFAULT 92 CHECK (x_pct >= 0 AND x_pct <= 100),
  y_pct numeric NOT NULL DEFAULT 8 CHECK (y_pct >= 0 AND y_pct <= 100),
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.page_guide_placement TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_guide_placement TO authenticated;
GRANT ALL ON public.page_guide_placement TO service_role;

ALTER TABLE public.page_guide_placement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tutorial button placement"
ON public.page_guide_placement FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Tutorial managers can set placement"
ON public.page_guide_placement FOR ALL TO authenticated
USING (public.can_manage_tutorials())
WITH CHECK (public.can_manage_tutorials());

CREATE OR REPLACE FUNCTION public.page_guide_placement_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_page_guide_placement_updated_at
BEFORE UPDATE ON public.page_guide_placement
FOR EACH ROW EXECUTE FUNCTION public.page_guide_placement_touch();