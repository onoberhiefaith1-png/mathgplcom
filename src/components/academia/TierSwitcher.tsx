import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_LABEL, cycleTier, type AcademiaTier } from "@/lib/academia/tiers";

/** Tier colours shared by the session selector and empty states. */
export const TIER_TONE: Record<AcademiaTier, string> = {
  beginner: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  intermediate: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  expert: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

/**
 * The one session tier selector (next-edition spec §3): top right of the
 * session, ◀ Tier ▶. Changing it swaps the video and the questions together.
 * Phone: 48px thumb targets; laptop: compact.
 */
const TierSwitcher = ({ value, onChange, className, label = "Tier" }: {
  value: AcademiaTier;
  onChange: (t: AcademiaTier) => void;
  className?: string;
  label?: string;
}) => (
  <div
    role="group"
    aria-label={`${label}: ${TIER_LABEL[value]}`}
    data-testid="tier-switcher"
    className={cn("inline-flex shrink-0 items-center rounded-full border p-0.5 shadow-sm", TIER_TONE[value], className)}
  >
    <button type="button" aria-label="Previous tier" onClick={() => onChange(cycleTier(value, -1))}
      className="grid h-12 w-12 place-items-center rounded-full transition hover:bg-background/60 md:h-9 md:w-9">
      <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
    </button>
    <span aria-live="polite" className="min-w-[6.5rem] text-center text-sm font-bold md:min-w-[6rem] md:text-xs">
      {TIER_LABEL[value]}
    </span>
    <button type="button" aria-label="Next tier" onClick={() => onChange(cycleTier(value, 1))}
      className="grid h-12 w-12 place-items-center rounded-full transition hover:bg-background/60 md:h-9 md:w-9">
      <ChevronRight className="h-5 w-5 md:h-4 md:w-4" />
    </button>
  </div>
);

export default TierSwitcher;
