-- Per-tier evaluation scores stay independent.
-- academia_attempts.tier was NOT NULL DEFAULT 'beginner', so every older row
-- was labelled Beginner even when the work was another tier or could not be
-- placed. This migration:
--   1. Allows NULL, meaning untiered. Untiered marks count only in Overall.
--   2. Drops the Beginner default so a missing tier is not silently Beginner.
--   3. Backfills a tier only when the attempt's scored activities (or, if it
--      has no scores, the activity that opened it) all sit in one tier.
--      Explicit Intermediate/Expert rows with no activity evidence are kept.
--      Mixed activities, or a Beginner default with nothing to confirm, become
--      NULL. If two rows would land on the same tier, the higher best score
--      keeps that tier and the other becomes untiered — no score is overwritten.
--   4. Records tier on academia_device_attempts and backfills it from the activity.
-- Existing RLS is unchanged and still applies to these columns:
--   "own academia attempts" — a student reads and writes only their rows.
--   "school and builders read attempts" — the school owner and subject builders read them.
--   "builders read device attempts" — builders read device rows; the sync route writes as service_role.

ALTER TABLE public.academia_attempts ALTER COLUMN tier DROP NOT NULL;
ALTER TABLE public.academia_attempts ALTER COLUMN tier DROP DEFAULT;
ALTER TABLE public.academia_attempts DROP CONSTRAINT IF EXISTS academia_attempts_tier_check;
ALTER TABLE public.academia_attempts ADD CONSTRAINT academia_attempts_tier_check
  CHECK (tier IS NULL OR tier IN ('beginner', 'intermediate', 'expert'));

CREATE TEMP TABLE academia_attempt_tier_backfill ON COMMIT DROP AS
WITH scored AS (
  SELECT
    att.id,
    att.session_id,
    att.user_id,
    att.mode,
    att.best_score,
    CASE
      WHEN cardinality(keys.tiers) = 1 THEN keys.tiers[1]
      WHEN cardinality(keys.tiers) > 1 THEN NULL
      WHEN att.tier IN ('intermediate', 'expert') THEN att.tier
      WHEN act.tier IN ('beginner', 'intermediate', 'expert') THEN act.tier
      ELSE NULL
    END AS desired
  FROM public.academia_attempts att
  LEFT JOIN public.academia_activities act ON act.id = att.activity_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      array_agg(DISTINCT a.tier) FILTER (WHERE a.tier IN ('beginner', 'intermediate', 'expert')),
      '{}'::text[]
    ) AS tiers
    FROM jsonb_object_keys(COALESCE(att.activity_scores, '{}'::jsonb)) AS k(activity_id)
    JOIN public.academia_activities a ON a.id::text = k.activity_id
  ) keys ON true
),
ranked AS (
  SELECT
    id,
    CASE
      WHEN desired IS NULL THEN NULL
      WHEN row_number() OVER (
        PARTITION BY session_id, user_id, mode, desired
        ORDER BY best_score DESC NULLS LAST, id
      ) = 1 THEN desired
      ELSE NULL
    END AS next_tier
  FROM scored
)
SELECT id, next_tier FROM ranked;

-- Clear first so two rows can exchange tiers without tripping the unique index.
UPDATE public.academia_attempts att
SET tier = NULL
FROM academia_attempt_tier_backfill b
WHERE att.id = b.id
  AND att.tier IS DISTINCT FROM b.next_tier;

UPDATE public.academia_attempts att
SET tier = b.next_tier
FROM academia_attempt_tier_backfill b
WHERE att.id = b.id
  AND b.next_tier IS NOT NULL
  AND att.tier IS DISTINCT FROM b.next_tier;

ALTER TABLE public.academia_device_attempts
  ADD COLUMN IF NOT EXISTS tier text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academia_device_attempts_tier_check') THEN
    ALTER TABLE public.academia_device_attempts
      ADD CONSTRAINT academia_device_attempts_tier_check
      CHECK (tier IS NULL OR tier IN ('beginner', 'intermediate', 'expert'));
  END IF;
END $$;

UPDATE public.academia_device_attempts d
SET tier = a.tier
FROM public.academia_activities a
WHERE d.activity_id = a.id
  AND d.tier IS NULL
  AND a.tier IN ('beginner', 'intermediate', 'expert');

COMMENT ON COLUMN public.academia_attempts.tier IS
  'beginner, intermediate or expert. NULL is untiered work counted only in Overall.';
COMMENT ON COLUMN public.academia_device_attempts.tier IS
  'Tier of the activity when the device synced. NULL when it could not be inferred; counted only in Overall.';
