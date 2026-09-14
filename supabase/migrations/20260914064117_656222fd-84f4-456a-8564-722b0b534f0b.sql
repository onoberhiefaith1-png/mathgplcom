ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS permanent_achievement_color text NOT NULL DEFAULT '#2563eb',
  ADD COLUMN IF NOT EXISTS current_attempt_color text NOT NULL DEFAULT '#7c3f20';

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_permanent_achievement_color_hex,
  ADD CONSTRAINT assessments_permanent_achievement_color_hex
    CHECK (permanent_achievement_color ~ '^#[0-9A-Fa-f]{6}$'),
  DROP CONSTRAINT IF EXISTS assessments_current_attempt_color_hex,
  ADD CONSTRAINT assessments_current_attempt_color_hex
    CHECK (current_attempt_color ~ '^#[0-9A-Fa-f]{6}$');