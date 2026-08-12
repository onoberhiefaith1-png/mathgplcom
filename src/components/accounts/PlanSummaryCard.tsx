import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";

import { useAccount } from "@/lib/accounts/useAccount";
import { credits, money } from "@/lib/costs/categories";
import { fetchMyPlan } from "@/lib/plans/plans.functions";

/**
 * Plan and credit allowance on the account page. Students never subscribe, so
 * the card simply does not render for them.
 */
const PlanSummaryCard = () => {
  const { role } = useAccount();
  const plan = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchMyPlan({}) });
  if (role === "student") return null;

  const current = plan.data?.subscription ?? null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <CreditCard className="h-4 w-4 text-slate-500" /> Plan &amp; credits
      </h2>
      {current ? (
        <>
          <p className="mt-1 text-sm text-slate-600">
            You are on <span className="font-semibold text-slate-900">{current.planLabel}</span> at{" "}
            {money(current.price, current.currency)} per month, including {credits(current.includedCredits)}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Price locked on version {current.versionNo ?? 0}
            {current.periodEnd ? ` until ${new Date(current.periodEnd).toLocaleDateString()}` : ""}.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-600">
          You have not chosen a plan yet. Every plan includes a monthly credit allowance at a price locked for your
          period.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/plans"
          className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          {current ? "Manage plan" : "Choose a plan"}
        </Link>
      </div>
    </section>
  );
};

export default PlanSummaryCard;
