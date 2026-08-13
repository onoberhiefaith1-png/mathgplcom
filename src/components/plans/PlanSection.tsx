import { Link } from "@/lib/router-compat";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";

import { credits, money } from "@/lib/costs/categories";
import { usePlanGate } from "@/lib/plans/usePlanGate";

/**
 * The Plan section shown on every dashboard: what this account is on right
 * now, what it includes and the way to change it. This is the account's *own*
 * platform subscription — not the teacher/school student pricing, which lives
 * in the Pricing workspace.
 */
const PlanSection = ({ className = "" }: { className?: string }) => {
  const { loading, subscribes, subscription, noPlansYet, expired, graceDaysLeft } = usePlanGate();

  // Students and the platform owner hold no plan of their own.
  if (!loading && !subscribes) return null;

  return (
    <section className={`rounded-2xl border border-white/10 bg-white/5 p-5 text-white backdrop-blur ${className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/90">
        <CreditCard className="h-3.5 w-3.5" /> Plan
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your plan…
        </p>
      ) : subscription ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-lg font-semibold">
            {subscription.planLabel}
            {expired ? (
              <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-rose-200">
                Expired — renewal required
              </span>
            ) : null}
          </div>
          <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-white/50">Price</div>
              <div className="font-semibold">{money(subscription.price, subscription.currency)}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Included credits</div>
              <div className="font-semibold">{credits(subscription.includedCredits)}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">{expired ? "Ended" : "Renews"}</div>
              <div className="font-semibold">
                {subscription.periodEnd ? new Date(subscription.periodEnd).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>
          {expired ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Your plan has ended and credit spending is paused. Everything you have made is safe.{" "}
                {graceDaysLeft !== null
                  ? `Renew within ${graceDaysLeft} ${graceDaysLeft === 1 ? "day" : "days"} to carry on where you left off — after that this account moves to the free plan.`
                  : "Renew to carry on where you left off."}
              </span>
            </p>
          ) : subscription.paymentState === "past_due" ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Your last payment did not go through. Credit spending is paused until it succeeds.</span>
            </p>
          ) : null}
        </>
      ) : noPlansYet ? (
        <p className="mt-2 text-sm text-white/70">
          No plans are published for your account type yet. Carry on working — your options will appear here as soon as
          they are available.
        </p>
      ) : (
        <p className="mt-2 text-sm text-white/70">You have not chosen a plan yet.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={subscription && !expired ? "/plans" : "/plans/gateway"}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-amber-400 px-4 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
        >
          {expired ? "Renew plan" : subscription ? "Manage plan" : "Choose a plan"}
        </Link>
        {subscription ? (
          <Link
            to="/plans"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-white/15 px-4 text-sm font-medium text-white/80 transition hover:bg-white/10"
          >
            Billing &amp; credits
          </Link>
        ) : null}
      </div>
    </section>
  );
};

export default PlanSection;
