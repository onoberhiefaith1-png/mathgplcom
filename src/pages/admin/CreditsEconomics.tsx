import DashboardShell from "@/components/accounts/DashboardShell";
import { Link } from "@/lib/router-compat";
import CostAnalytics from "@/pages/admin/CostAnalytics";
import BillingCosts from "@/pages/admin/BillingCosts";

const pill =
  "inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface backdrop-blur transition hover:bg-dash-surface/20";

/**
 * Section two of the admin economics area: the global inputs, the credit
 * position, the provider price book and the cost catalogue, in one page.
 * Everything internal is GBP.
 */
export default function CreditsEconomics() {
  return (
    <DashboardShell
      title="Credits & Economics"
      subtitle="Cost per credit and profit percentage are the only inputs. The credit sell price, plan credits and pack prices are all derived from them — in pounds."
      actions={
        <>
          <Link to="/admin/plans" className={pill}>
            Plans
          </Link>
          <Link to="/admin/usage-revenue" className={pill}>
            Usage &amp; Revenue
          </Link>
        </>
      }
    >
      <div className="space-y-8">
        <CostAnalytics embedded />
        <BillingCosts embedded />
      </div>
    </DashboardShell>
  );
}
