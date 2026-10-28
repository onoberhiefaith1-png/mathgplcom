// Reports → Speed Performance entry card.

import { Link } from "@/lib/router-compat";
import { Gauge } from "lucide-react";

const SpeedPerformanceCard = ({ to, subtitle }: { to: string; subtitle: string }) => (
  <Link
    to={to}
    className="group mt-5 flex items-center gap-4 rounded-2xl border border-[hsl(var(--rp-border))] bg-[hsl(var(--rp-panel))] p-4 transition hover:border-[hsl(var(--rp-fg))]"
  >
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--rp-border))]">
      <Gauge className="h-5 w-5" aria-hidden />
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-semibold">Speed Performance</span>
      <span className="block text-xs text-[hsl(var(--rp-muted))]">{subtitle}</span>
    </span>
  </Link>
);

export default SpeedPerformanceCard;
