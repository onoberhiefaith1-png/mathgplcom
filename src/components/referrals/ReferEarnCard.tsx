import { Gift } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { useReferralAccess, useReferralSummary } from "@/lib/referrals/useReferrals";
import { formatMoney } from "@/lib/referrals/types";

/**
 * The Refer & Earn summary that sits beside the other workspace cards. It only
 * renders for the accounts that have referral access at all.
 */
const ReferEarnCard = () => {
  const { scope } = useReferralAccess();
  const { data, isLoading } = useReferralSummary();
  if (!scope) return null;

  const earned = data?.earned ?? [];

  return (
    <Link
      to="/referral"
      className="block rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
          <Gift className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold">Refer & Earn</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Referred", value: data?.referred },
          { label: "Registered", value: data?.registered },
          { label: "Subscribed", value: data?.subscribed },
        ].map((stat) => (
          <span key={stat.label}>
            <span className="block text-xl font-semibold tabular-nums">
              {isLoading ? "—" : stat.value ?? 0}
            </span>
            <span className="block text-[11px] text-muted-foreground">{stat.label}</span>
          </span>
        ))}
      </div>
      <div className="mt-3 border-t border-border/50 pt-2 text-xs text-muted-foreground">
        {earned.length === 0
          ? "No reward earned yet"
          : `Earned ${earned.map((total) => formatMoney(total.amount, total.currency)).join(" · ")}`}
      </div>
    </Link>
  );
};

export default ReferEarnCard;
