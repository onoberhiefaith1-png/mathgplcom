UPDATE public.profiles
SET homepage_config = homepage_config - 'slotOverrides'
WHERE homepage_config ? 'slotOverrides'
  AND (homepage_config -> 'slotOverrides') ?| array['ring-0','ring-2','ring-4','ring-6','ring-7'];