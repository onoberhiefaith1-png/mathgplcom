/** Shared status presentation for the Audit Dashboard. */
import type { RequirementStatus } from "@/lib/integrity/types";
import type { Counts } from "@/lib/integrity/segments";

const TONE: Record<RequirementStatus, string> = {
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PARTIAL: "border-amber-200 bg-amber-50 text-amber-700",
  UNKNOWN: "border-slate-300 bg-slate-100 text-slate-600",
  FAIL: "border-rose-200 bg-rose-50 text-rose-700",
  MISSING: "border-rose-200 bg-rose-50 text-rose-700",
};

export const StatusPill = ({ status }: { status: RequirementStatus }) => (
  <span
    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${TONE[status]}`}
  >
    {status}
  </span>
);

export const STATUS_MEANING: Record<RequirementStatus, string> = {
  PASS: "Verified and working.",
  PARTIAL: "Some required behaviour exists, but something is incomplete or incorrect.",
  UNKNOWN: "Insufficient evidence to confirm the requirement.",
  FAIL: "The requirement is demonstrably absent or broken.",
  MISSING: "The requirement is demonstrably absent.",
};

export const TOTAL_LABELS: Array<{ key: keyof Counts; label: string }> = [
  { key: "PASS", label: "Pass" },
  { key: "PARTIAL", label: "Partial" },
  { key: "UNKNOWN", label: "Unknown" },
  { key: "FAIL", label: "Fail" },
  { key: "MISSING", label: "Missing" },
];
