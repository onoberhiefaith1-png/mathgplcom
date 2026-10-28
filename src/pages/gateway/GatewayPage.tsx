import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { useNavigate, useParams } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { itemLabel, money } from "@/lib/gateway/items";
import { loadMyEntitlement, type GatewayBillingInterval } from "@/lib/gateway/gateway";
import { useChoosePlan, useGatewayByHandle, usePlanCheckout } from "@/lib/gateway/useGateway";

/**
 * The Gateway.
 *
 * The door to a teacher's or a school's workspace. A student always meets it
 * first — arriving from the public link or straight after joining with a code —
 * and chooses the package that teacher or school offers. It is that owner's
 * offer, at that owner's price.
 */
const GatewayPage = () => {
  const { handle } = useParams<{ handle?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, isLoading } = useGatewayByHandle(handle);
  const choose = useChoosePlan();
  const checkout = usePlanCheckout();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null);
  const [intervals, setIntervals] = useState<Record<string, GatewayBillingInterval>>({});
  const returned = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("checkout") : null;

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data: userData }) => {
      if (!cancelled) setSignedIn(Boolean(userData.user));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data?.ownerId || !signedIn) return;
    let cancelled = false;
    void loadMyEntitlement(data.ownerId).then((entitlement) => {
      if (!cancelled) setChosenPlanId(entitlement?.planId ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [data?.ownerId, signedIn]);

  const pick = async (planId: string, price: number | null, interval: GatewayBillingInterval) => {
    if (!signedIn) {
      navigate(`/auth?redirect=/g/${handle ?? ""}`);
      return;
    }

    // A paid plan is settled by Stripe on the teacher's or school's own
    // account; access is granted only when Stripe confirms it.
    if (price && price > 0) {
      try {
        await checkout.mutateAsync({ planId, interval });
      } catch (error) {
        toast({
          title: "Could not open payment",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "destructive",
        });
      }
      return;
    }

    try {
      const entitlement = await choose.mutateAsync(planId);
      setChosenPlanId(entitlement.planId);
      if (entitlement.status === "pending_payment") {
        toast({
          title: "Plan reserved",
          description: `Payment for this plan opens soon. ${data?.ownerName ?? "Your teacher"} will be notified.`,
        });
      } else {
        toast({ title: "You're in", description: "Your access is ready." });
        navigate("/student");
      }
    } catch (error) {
      toast({
        title: "Could not choose that plan",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
    void price;
  };

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">No gateway here yet</h1>
          <p className="text-sm text-muted-foreground">
            {handle ? `@${handle}` : "This account"} has not published any plans. Ask them for a join code instead.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <header className="space-y-2 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {data.ownerKind === "school" ? "School gateway" : "Teacher gateway"}
          </p>
          <h1 className="text-3xl font-semibold">{data.ownerName}</h1>
          <p className="text-sm text-muted-foreground">@{data.username} · choose how you learn here</p>
        </header>

        {returned === "success" ? (
          <p className="mx-auto mt-6 max-w-xl rounded-xl border border-primary/40 bg-primary/10 p-3 text-center text-sm">
            Thank you — Stripe is confirming your payment. Your access opens as soon as it clears.
          </p>
        ) : returned === "cancelled" ? (
          <p className="mx-auto mt-6 max-w-xl rounded-xl border border-border/60 bg-muted/30 p-3 text-center text-sm text-muted-foreground">
            Payment was cancelled. You can choose a plan again whenever you are ready.
          </p>
        ) : null}

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {data.plans.map((plan) => {
            const chosen = chosenPlanId === plan.id;
            const free = !plan.price || plan.price <= 0;
            const available: GatewayBillingInterval[] = free ? [] : [
              ...(plan.oneTimeEnabled ? ["one_off" as const] : []),
              ...(plan.monthlyEnabled ? ["monthly" as const] : []),
              ...(plan.yearlyEnabled ? ["yearly" as const] : []),
            ];
            const interval = intervals[plan.id] ?? available[0] ?? "monthly";
            const shownPrice = interval === "yearly"
              ? (plan.price ?? 0) * 12 * (1 - plan.yearlyDiscountPercentage / 100)
              : plan.price ?? 0;
            return (
              <section
                key={plan.id}
                className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur"
              >
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  {plan.description ? (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  ) : null}
                </div>

                <p className="text-2xl font-semibold">
                  {money(shownPrice, plan.currency)}
                  {!free ? <span className="ml-1 text-xs font-normal text-muted-foreground">/{interval === "yearly" ? "year" : interval === "monthly" ? "month" : "once"}</span> : null}
                </p>
                {available.length > 1 ? (
                  <div className="grid grid-cols-3 gap-1" aria-label="Payment frequency">
                    {available.map((option) => (
                      <Button key={option} type="button" size="sm" variant={interval === option ? "default" : "outline"} onClick={() => setIntervals((current) => ({ ...current, [plan.id]: option }))}>
                        {option === "one_off" ? "Once" : option === "monthly" ? "Monthly" : "Yearly"}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {interval === "yearly" && plan.yearlyDiscountPercentage > 0 ? <p className="text-xs text-primary">Save {plan.yearlyDiscountPercentage}% yearly</p> : null}

                <ul className="flex-1 space-y-1.5 text-sm">
                  {plan.items.length === 0 ? (
                    <li className="text-muted-foreground">Nothing included yet.</li>
                  ) : (
                    plan.items.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{itemLabel(item)}</span>
                      </li>
                    ))
                  )}
                </ul>

                <Button
                  onClick={() => void pick(plan.id, plan.price, interval)}
                  disabled={choose.isPending || checkout.isPending || chosen || (!free && (!data.paymentsActive || available.length === 0))}
                  className="min-h-11 w-full"
                >
                  {chosen
                    ? "Your plan"
                    : free
                      ? `Choose ${plan.name}`
                      : !data.paymentsActive ? "Payments not active" : interval === "one_off" ? "Pay with Stripe" : "Subscribe with Stripe"}
                </Button>
                {!free ? (
                  <p className="text-center text-[11px] text-muted-foreground">
                    {interval === "yearly" ? "Billed yearly by" : interval === "monthly" ? "Billed monthly by" : "Paid directly to"}{" "}
                    {data.ownerName} through Stripe.
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Some individual courses, adventures or assignments inside a plan may ask for their own access later.
        </p>
      </div>
    </main>
  );
};

export default GatewayPage;
