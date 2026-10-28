// Times are typed and read as MM:SS everywhere a teacher sets a duration.
// Storage stays in whole seconds — only the display layer changes.

/** 95 → "01:35". Negative or non-finite values become "00:00". */
export const formatMmSs = (totalSeconds: number | null | undefined): string => {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

/**
 * Accepts "MM:SS", "M:S", "90" (seconds) or "" (no time).
 * Returns whole seconds, or null when there is no usable time.
 */
export const parseMmSs = (raw: string): number | null => {
  const text = (raw ?? "").trim();
  if (!text) return null;
  if (!/^\d{0,3}(:\d{0,2})?$/.test(text)) return null;
  if (text.includes(":")) {
    const [m, s] = text.split(":");
    const mins = Math.max(0, Math.floor(Number(m) || 0));
    const secs = Math.min(59, Math.max(0, Math.floor(Number(s) || 0)));
    const total = mins * 60 + secs;
    return total > 0 ? total : null;
  }
  const total = Math.max(0, Math.floor(Number(text) || 0));
  return total > 0 ? total : null;
};
