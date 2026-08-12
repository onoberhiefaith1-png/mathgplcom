import DashboardShell from "@/components/accounts/DashboardShell";
import { Link } from "@/lib/router-compat";
import UsageAnalytics from "@/pages/admin/UsageAnalytics";
import CostRevenueAnalysis from "@/pages/admin/CostRevenueAnalysis";

const pill =
  "inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface backdrop-blur transition hover:bg-dash-surface/20";

/**
 * Section three of the admin economics area: what was used and what it earned,
 * over time. Measurement and money in one place, GBP only.
 */
export default function UsageRevenue() {
  return (
    <DashboardShell
      title="Usage & Revenue"
      subtitle="Measured usage and the revenue it produced, over the period you choose. Every figure is metered, never estimated."
      actions={
        <>
          <Link to="/admin/plans" className={pill}>
            Plans
          </Link>
          <Link to="/admin/credits" className={pill}>
            Credits &amp; Economics
          </Link>
        </>
      }
    >
      <div className="space-y-8">
        <UsageAnalytics embedded />
        <CostRevenueAnalysis embedded />
      </div>
    </DashboardShell>
  );
}
