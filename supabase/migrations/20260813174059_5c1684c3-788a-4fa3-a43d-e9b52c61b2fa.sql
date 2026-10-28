ALTER TABLE public.platform_advertisements
  ADD COLUMN IF NOT EXISTS ad_kind text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS adsense_slot_id text;

ALTER TABLE public.platform_advertisements
  DROP CONSTRAINT IF EXISTS platform_advertisements_ad_kind_check;
ALTER TABLE public.platform_advertisements
  ADD CONSTRAINT platform_advertisements_ad_kind_check CHECK (ad_kind IN ('media','adsense'));