/** Offline, AI-free line marking for the Academia app. */
import { provesEquivalent } from "@/lib/predictive/predictiveLine";

export function markLine(expected: string, written: string): boolean {
  const e = expected.trim();
  const s = written.trim();
  if (!e || !s) return false;
  if (e.replace(/\s+/g, "") === s.replace(/\s+/g, "")) return true;
  try {
    return provesEquivalent(e, s);
  } catch {
    return false;
  }
}
