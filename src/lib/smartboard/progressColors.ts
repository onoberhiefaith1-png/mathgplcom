export const DEFAULT_PERMANENT_ACHIEVEMENT_COLOR = "#2563eb";
export const DEFAULT_CURRENT_ATTEMPT_COLOR = "#7c3f20";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const resolveProgressColor = (value: unknown, fallback: string): string =>
  typeof value === "string" && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;

export const resolveProgressColors = (values?: {
  permanentAchievementColor?: unknown;
  currentAttemptColor?: unknown;
}) => ({
  permanentAchievementColor: resolveProgressColor(
    values?.permanentAchievementColor,
    DEFAULT_PERMANENT_ACHIEVEMENT_COLOR,
  ),
  currentAttemptColor: resolveProgressColor(
    values?.currentAttemptColor,
    DEFAULT_CURRENT_ATTEMPT_COLOR,
  ),
});