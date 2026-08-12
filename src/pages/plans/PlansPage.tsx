import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { credits, money } from "@/lib/costs/categories";
import { useAccount } from "@/lib/accounts/useAccount";
import {
  fetchMyPlan,
  fetchPublishedPlans,
  requestUpgrade,
  startFreeSubscription,
} from "@/lib/plans/plans.functions";

type Audience = "teacher" | "school" | "parent";

const AUDIENCE_FOR_ROLE: Record<string, Audience | null> = {
  school: "school",
  teacher: "teacher",
  parent: "parent",
  student: null,
  platform_owner: "teacher",
  co_admin: "teacher",
};

/**
 * The member's own plan screen. Students never see plans — their access comes
 * from the school or teacher they are connected to.
 */
export default function PlansPage() {
  const qc = useQueryClient();
  const { role, isLoading } = useAccount();
  const audience = role ? AUDIENCE_FOR_ROLE[role] ?? null : null;
  const [pending, setPending] = useState<string | null>(null);

  const plans = useQuery({
    queryKey: ["published-plans", audience],
    queryFn: () => fetchPublishedPlans({ data: audience ? { audience } : {} }),
    enabled: !!audience,
  });

  const mine = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchMyPlan({}) });
  const current = mine.data?.subscription ?? null;

  const startFree = useMutation({
    mutationFn: (planKey: string) => startFreeSubscription({ data: { planKey } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-plan"] });
      toast.success("Your plan is active and its credits are in your wallet.");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  const upgrade = useMutation({
    mutationFn: (planKey: string) => requestUpgrade({ data: { planKey } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-plan"] });
      toast.success("Upgrade noted. Checkout opens as soon as payments are connected.");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  const rows = useMemo(() => plans.data?.plans ?? [], [plans.data?.plans]);

  return (
    <main className="cinematic-sky min-h-screen p-6 text-foreground">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.4em] text-primary">MathGPL</p>
        <h1 className="mt-2 text-3xl font-semibold">Your plan</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every plan includes a monthly credit allowance. Credits are what the platform's generation, lessons and live
          sessions run on, and your price is locked for as long as your period runs.
        </p>

        {isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your account…
          </div>
        ) : null}

        {current ? (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-card/60 p-5 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Current plan</div>
            <div className="mt-1 text-xl font-semibold">{current.planLabel}</div>
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Price</div>
                <div className="font-semibold">{money(current.price, current.currency)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Included credits</div>
                <div className="font-semibold">{credits(current.includedCredits)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Renews</div>
                <div className="font-semibold">
                  {current.periodEnd ? new Date(current.periodEnd).toLocaleDateString() : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Locked version</div>
                <div className="font-semibold">v{current.versionNo ?? 0}</div>
              </div>
            </div>
            {current.scheduledPlanId ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Scheduled change: <span className="font-semibold">{current.scheduledPlanId}</span> — it starts once the
                payment is confirmed.
              </p>
            ) : null}
          </div>
        ) : null}

        {!audience && !isLoading ? (
          <div className="mt-8 rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
            Student accounts do not need a plan. Your access comes from the school or teacher you are connected to.
            <div className="mt-3">
              <Link to="/home" className="text-primary hover:underline">
                ← Back to your dashboard
              </Link>
            </div>
          </div>
        ) : null}

        {audience ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((plan) => {
              const isCurrent = current?.planKey === plan.key;
              const comingSoon = plan.status === "coming_soon";
              return (
                <div
                  key={plan.key}
                  className={`flex flex-col rounded-2xl border p-5 backdrop-blur ${
                    isCurrent ? "border-primary/60 bg-primary/10" : "border-border bg-card/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-lg font-semibold">{plan.label}</div>
                    {comingSoon ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Coming soon
                      </span>
                    ) : null}
                  </div>
                  {plan.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                  ) : null}

                  {comingSoon ? (
                    <p className="mt-4 text-sm text-muted-foreground">Details will be announced.</p>
                  ) : (
                    <>
                      <div className="mt-4 text-2xl font-semibold">
                        {plan.price === 0 ? "Free" : `${money(plan.price, plan.currency)}`}
                        {plan.price === 0 ? null : (
                          <span className="text-sm font-normal text-muted-foreground"> / month</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {plan.includedCredits > 0
                          ? `${credits(plan.includedCredits)} included each month`
                          : "Credits are added by your school or teacher"}
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
                    </>
                  )}

                  <div className="mt-auto pt-5">
                    {isCurrent ? (
                      <Button className="w-full" variant="secondary" disabled>
                        Your current plan
                      </Button>
                    ) : comingSoon ? (
                      <Button className="w-full" variant="secondary" disabled>
                        Coming soon
                      </Button>
                    ) : plan.price === 0 ? (
                      <Button
                        className="w-full"
                        disabled={pending === plan.key}
                        onClick={() => {
                          setPending(plan.key);
                          startFree.mutate(plan.key);
                        }}
                      >
                        {pending === plan.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Start free plan
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={pending === plan.key}
                        onClick={() => {
                          setPending(plan.key);
                          upgrade.mutate(plan.key);
                        }}
                      >
                        {pending === plan.key ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Choose {plan.label}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <p className="mt-8 text-xs text-muted-foreground">
          <Link to="/account" className="text-primary hover:underline">
            ← Back to your account
          </Link>
        </p>
      </div>
    </main>
  );
}
