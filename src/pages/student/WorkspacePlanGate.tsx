import { useState } from "react";
import { ArrowLeft, Check, Loader2, Lock } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { itemLabel, money } from "@/lib/gateway/items";
import type { GatewayBillingInterval, GatewayOwnerView } from "@/lib/gateway/gateway";
import { useChoosePlan, usePlanCheckout } from "@/lib/gateway/useGateway";

/**
 * The plan page a student meets *before* the building.
 *
 * It is the owner's own offer, exactly as they arranged it under Pricing: every
 * published plan, free ones included, with what each one opens. The free plan
 * lets a student in at once; a paid plan goes through that owner's Stripe.
 */
const WorkspacePlanGate = ({
  view,
  kind,
  ownerName,
  checkoutState,
  onChosen,
}: {
  view: GatewayOwnerView;
  kind: "school" | "teacher";
  ownerName: string;
  checkoutState?: string | null;
  onChosen: () => void;
}) => {
  const { toast } = useToast();
  const choose = useChoosePlan();
  const checkout = usePlanCheckout();
  const [intervals, setIntervals] = useState<Record<string, GatewayBillingInterval>>({});

  const pick = async (planId: string, price: number | null, interval: GatewayBillingInterval) => {
    if (price && price > 0) {
      try {
        await checkout.mutateAsync({ planId, interval, returnPath: window.location.pathname });
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
      if (entitlement.status === "pending_payment") {
        toast({
          title: "Plan reserved",
          description: `${ownerName} will confirm this plan shortly.`,
        });
        return;
      }
      onChosen();
    } catch (error) {
      toast({
        title: "Could not choose that plan",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const busy = choose.isPending || checkout.isPending;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 px-5 py-10 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          to="/student"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/60 px-4 text-sm transition hover:border-primary/50"
        >
          <ArrowLeft className="h-4 w-4" /> My Dashboard
        </Link>

        <header className="mt-8 space-y-2 text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {kind === "school" ? "School workspace" : "Teacher workspace"}
          </p>
          <h1 className="text-3xl font-semibold">{ownerName}</h1>
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Choose how you learn here to open this workspace
          </p>
        </header>

        {checkoutState === "success" ? (
          <p className="mx-auto mt-6 max-w-xl rounded-xl border border-primary/40 bg-primary/10 p-3 text-center text-sm">
            Thank you — your payment is being confirmed. This workspace opens as soon as it clears.
          </p>
        ) : checkoutState === "cancelled" ? (
          <p className="mx-auto mt-6 max-w-xl rounded-xl border border-border/60 bg-muted/30 p-3 text-center text-sm text-muted-foreground">
            Payment was cancelled. You can choose a plan again whenever you are ready.
          </p>
        ) : null}

        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {view.plans.map((plan) => {
            const free = !plan.price || plan.price <= 0;
            const available: GatewayBillingInterval[] = free
              ? []
              : [
                  ...(plan.oneTimeEnabled ? ["one_off" as const] : []),
                  ...(plan.monthlyEnabled ? ["monthly" as const] : []),
                  ...(plan.yearlyEnabled ? ["yearly" as const] : []),
                ];
            const interval = intervals[plan.id] ?? available[0] ?? "monthly";
            const shownPrice =
              interval === "yearly"
                ? (plan.price ?? 0) * 12 * (1 - plan.yearlyDiscountPercentage / 100)
                : plan.price ?? 0;

            return (
              <section
                key={plan.id}
                className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur"
              >
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  {plan.description ? <p className="text-sm text-muted-foreground">{plan.description}</p> : null}
                </div>

                <p className="text-2xl font-semibold">
                  {free ? "Free" : money(shownPrice, plan.currency)}
                  {!free ? (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      /{interval === "yearly" ? "year" : interval === "monthly" ? "month" : "once"}
                    </span>
                  ) : null}
                </p>

                {available.length > 1 ? (
                  <div className="grid grid-cols-3 gap-1" aria-label="Payment frequency">
                    {available.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={interval === option ? "default" : "outline"}
                        onClick={() => setIntervals((current) => ({ ...current, [plan.id]: option }))}
                      >
                        {option === "one_off" ? "Once" : option === "monthly" ? "Monthly" : "Yearly"}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {interval === "yearly" && plan.yearlyDiscountPercentage > 0 ? (
                  <p className="text-xs text-primary">Save {plan.yearlyDiscountPercentage}% yearly</p>
                ) : null}

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
                  disabled={busy || (!free && (!view.paymentsActive || available.length === 0))}
                  className="min-h-11 w-full"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : free ? (
                    `Enter with ${plan.name}`
                  ) : !view.paymentsActive ? (
                    "Payments not active"
                  ) : interval === "one_off" ? (
                    "Pay with Stripe"
                  ) : (
                    "Subscribe with Stripe"
                  )}
                </Button>
                {!free ? (
                  <p className="text-center text-[11px] text-muted-foreground">
                    {interval === "yearly" ? "Billed yearly by" : interval === "monthly" ? "Billed monthly by" : "Paid directly to"}{" "}
                    {ownerName} through Stripe.
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          You only get what this plan includes — anything outside it stays closed until you upgrade.
        </p>
      </div>
    </main>
  );
};

export default WorkspacePlanGate;
