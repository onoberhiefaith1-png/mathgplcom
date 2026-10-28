-- Referral attribution records who referred, not only which account id.
ALTER TABLE public.referral_links ADD COLUMN IF NOT EXISTS referrer_kind TEXT;
ALTER TABLE public.referral_attributions ADD COLUMN IF NOT EXISTS referrer_kind TEXT;

UPDATE public.referral_links l
SET referrer_kind = r.role::text
FROM public.user_roles r
WHERE r.user_id = l.referrer_user_id AND l.referrer_kind IS NULL;

UPDATE public.referral_attributions a
SET referrer_kind = r.role::text
FROM public.user_roles r
WHERE r.user_id = a.referrer_user_id AND a.referrer_kind IS NULL;

CREATE INDEX IF NOT EXISTS referral_attributions_referrer_kind_idx
  ON public.referral_attributions (referrer_kind);