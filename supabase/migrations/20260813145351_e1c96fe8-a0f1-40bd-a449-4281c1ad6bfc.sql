ALTER TABLE public.platform_advertisements
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_ad_id text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS click_url text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

ALTER TABLE public.platform_advertisements
  DROP CONSTRAINT IF EXISTS platform_advertisements_provider_check;

ALTER TABLE public.platform_advertisements
  ADD CONSTRAINT platform_advertisements_provider_check
  CHECK (provider IN ('manual', 'google', 'other'));