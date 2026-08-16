import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import BackButton from "@/components/common/BackButton";
import PaymentTestModeBanner from "@/components/PaymentTestModeBanner";
import { PolicyLinks } from "./PublicPricingPage";
import { credits, money } from "@/lib/costs/categories";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { priceKeyForPlan, type BillingInterval } from "@/lib/paddle";
import { startFreeSubscription } from "@/lib/plans/plans.functions";
import { usePlanGate } from "@/lib/plans/usePlanGate";
import { useAccount } from "@/lib/accounts/useAccount";
import { useAuth } from "@/lib/auth/AuthProvider";
import { WORKSPACE_PATH } from "@/lib/accounts/roles";

/**
 * The Plan Gateway: the one place a new verified account chooses its platform
 * plan before entering the workspace.
 *
 * Free plans start immediately. Paid plans go through checkout and only become
 * active once the payment is confirmed — this screen never grants a paid plan
 * itself. An account that already holds a plan is not asked again.
 */
export default function PlanGatewayPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, ready } = useAuth();
  const { role } = useAccount();
  const { loading, subscribes, subscription, choices, noPlansYet, freeAccess } = usePlanGate();
  const [pending, setPending] = useState<string | null>(null);
  const [interval, setInterval_] = useState<BillingInterval>("monthly");
  const [confirming, setConfirming] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("checkout") === "success",
  );

  const workspace = role ? WORKSPACE_PATH[role] ?? "/" : "/";
  // Choosing a plan is a one-time onboarding step. An account that already
  // holds one only sees the chooser when it asks for it from the dashboard.
  const changing =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("change");
  const settled = Boolean(subscription) || freeAccess || noPlansYet;

  // Signed-out visitors belong on the public pricing page.
  useEffect(() => {
    if (ready && !user) navigate("/plans", { replace: true });
  }, [ready, user, navigate]);

  // Plan already saved: straight into the workspace, never back through here.
  useEffect(() => {
    if (loading || confirming || changing || !settled) return;
    navigate(workspace, { replace: true });
  }, [loading, confirming, changing, settled, workspace, navigate]);


  // Returning from checkout: poll until the confirmed payment lands.
  useEffect(() => {
    if (!confirming) return;
    const timer = setInterval(() => void qc.invalidateQueries({ queryKey: ["my-plan"] }), 4000);
    const stop = setTimeout(() => setConfirming(false), 60_000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [confirming, qc]);

  const startFree = useMutation({
    mutationFn: (planKey: string) => startFreeSubscription({ data: { planKey } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-plan"] });
      toast.success("Your plan is active — welcome in.");
      navigate(workspace, { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  const { openCheckout } = usePaddleCheckout();

  const buy = async (planKey: string, interval: BillingInterval) => {
    setPending(planKey);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Please sign in first.");
      await openCheckout({
        priceId: priceKeyForPlan(planKey, interval),
        customerEmail: data.user.email ?? undefined,
        customData: { userId: data.user.id },
        successUrl: `${window.location.origin}/plans/gateway?checkout=success`,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  if (!ready || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your plan options…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-5xl px-6 py-14">
        <BackButton
          fallback="/welcome"
          className="mb-6 inline-flex min-h-9 items-center gap-2 rounded-full border border-border/60 px-4 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
          ariaLabel="Back"
        >
          <span>Back</span>
        </BackButton>
        <p className="text-xs uppercase tracking-[0.4em] text-primary">MathGPL</p>

        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Choose your plan</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your account is verified. Pick the plan you want to start on — every plan includes a monthly credit allowance,
          and you can change plan later from your dashboard.
        </p>

        {subscription ? (
          <div className="mt-8 rounded-2xl border border-primary/30 bg-card/60 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Plan active
            </div>
            <p className="mt-2 text-sm">
              You are on <span className="font-semibold">{subscription.planLabel}</span> at{" "}
              {money(subscription.price, subscription.currency)}{" "}
              {subscription.billingInterval === "yearly" ? "per year" : "per month"}, including{" "}
              {credits(subscription.includedCredits)}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link to={workspace}>Continue to my workspace</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/plans">Manage plan</Link>
              </Button>
            </div>
          </div>
        ) : confirming ? (
          <div className="mt-8 flex items-center gap-2 rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> We are confirming your payment. Your plan activates as soon as
            it clears — this page updates on its own.
          </div>
        ) : null}

        {!loading && freeAccess ? (
          <div className="mt-8 rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
            This account already has full access — no plan or payment is needed.
            <div className="mt-4">
              <Button asChild>
                <Link to={workspace}>Continue to my workspace</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {!subscribes && !freeAccess ? (
          <div className="mt-8 rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
            Your account type does not need a plan.{" "}
            <Link to={workspace} className="font-semibold text-foreground hover:underline">
              Continue to your workspace
            </Link>
            .
          </div>
        ) : null}

        {subscribes && !freeAccess && noPlansYet ? (
          <div className="mt-8 rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
            No plans are published for your account type yet, so nothing is needed from you right now.
            <div className="mt-4">
              <Button asChild>
                <Link to={workspace}>Continue to my workspace</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {subscribes && !freeAccess && !subscription && choices.length ? (

          <>
            <div className="mt-8 inline-flex rounded-xl border border-border bg-card/60 p-1 text-sm">
              {(["monthly", "yearly"] as BillingInterval[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setInterval_(option)}
                  className={`min-h-11 rounded-lg px-4 font-medium transition ${
                    interval === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {option === "monthly" ? "Monthly" : "Yearly — save 20%"}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {choices.map((plan) => {
                const free = plan.price === 0;
                const yearly = interval === "yearly" && plan.yearlyAvailable;
                const busy = pending === plan.key || startFree.isPending;
                return (
                  <div key={plan.key} className="flex flex-col rounded-2xl border border-border bg-card/60 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg font-semibold">{plan.label}</div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {free ? "Free" : "Subscription"}
                      </span>
                    </div>
                    {plan.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                    ) : null}
                    <div className="mt-4 text-2xl font-semibold">
                      {free
                        ? "Free"
                        : money(yearly ? plan.yearlyPrice : plan.price, plan.currency)}
                      {free ? null : (
                        <span className="text-sm font-normal text-muted-foreground">
                          {yearly ? " / year" : " / month"}
                        </span>
                      )}
                    </div>
                    {!free && yearly ? (
                      <div className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {money(plan.standardAnnualPrice, plan.currency)} if paid monthly — you save{" "}
                        {money(plan.standardAnnualPrice - plan.yearlyPrice, plan.currency)} ({plan.yearlyDiscountPercentage}% off)
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {plan.includedCredits > 0 ? `${credits(plan.includedCredits)} included every month` : "No credits included"}
                    </div>
                    {plan.features.length ? (
                      <ul className="mt-4 space-y-1.5 text-sm">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-auto pt-5">
                      <Button
                        className="w-full"
                        disabled={busy}
                        onClick={() => {
                          if (free) {
                            setPending(plan.key);
                            startFree.mutate(plan.key);
                          } else {
                            void buy(plan.key, yearly ? "yearly" : "monthly");
                          }
                        }}
                      >
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {free
                          ? `Start ${plan.label}`
                          : yearly
                            ? `Choose ${plan.label} — yearly`
                            : `Choose ${plan.label}`}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5 text-xs text-muted-foreground">
              <p>
                Monthly plans are billed every month; yearly plans are one annual payment with 20% off and renew each
                year until cancelled. Whichever you choose, the price is locked for the whole period you pay for, and a
                paid plan only becomes active once your payment is confirmed.
              </p>
              <PolicyLinks />
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
