import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/common/SiteFooter";
import PaymentTestModeBanner from "@/components/PaymentTestModeBanner";
import { credits, money } from "@/lib/costs/categories";
import { BRAND, SELLER_LEGAL_NAME } from "@/lib/legal/seller";
import { fetchPublicCreditPacks, fetchPublishedPlans } from "@/lib/plans/plans.functions";

type Audience = "teacher" | "school" | "parent";

const TABS: { key: Audience; label: string; blurb: string }[] = [
  { key: "teacher", label: "Teaching", blurb: "For an individual teacher or tutor." },
  { key: "school", label: "School", blurb: "For a school running several teachers and classes." },
  { key: "parent", label: "Family", blurb: "For a parent following their children's learning." },
];

/** Legal links shown next to every purchase entry point. */
export const PolicyLinks = () => (
  <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    <Link to="/terms" className="hover:text-foreground hover:underline">
      Terms of Service
    </Link>
    <Link to="/privacy" className="hover:text-foreground hover:underline">
      Privacy Policy
    </Link>
    <Link to="/refund-policy" className="hover:text-foreground hover:underline">
      Refund Policy
    </Link>
    <Link to="/support" className="hover:text-foreground hover:underline">
      Support
    </Link>
  </p>
);

/**
 * Pricing as a visitor sees it, with no account. It reads the same published
 * plan versions and the same live credit sell price as the signed-in plan
 * screen and checkout, so there is only ever one source of truth.
 */
export default function PublicPricingPage() {
  const [audience, setAudience] = useState<Audience>("teacher");
  /** Which card is showing the "create an account first" note. */
  const [selected, setSelected] = useState<string | null>(null);


  const plans = useQuery({
    queryKey: ["public-plans", audience],
    queryFn: () => fetchPublishedPlans({ data: { audience } }),
  });
  const packs = useQuery({ queryKey: ["public-credit-packs"], queryFn: () => fetchPublicCreditPacks({}) });

  const rows = plans.data?.plans ?? [];
  const tab = TABS.find((t) => t.key === audience)!;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-xs uppercase tracking-[0.4em] text-primary">{BRAND}</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Plans and pricing</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {BRAND} is a mathematics teaching and learning platform sold by {SELLER_LEGAL_NAME}. Every paid plan includes a
          monthly credit allowance — credits are what lesson generation, marking, live sessions and adventures run on.
          You can also buy credits on their own, without a subscription.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={t.key === audience ? "default" : "secondary"}
              onClick={() => setAudience(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{tab.blurb}</p>

        {plans.isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
          </div>
        ) : null}

        {!plans.isLoading && !rows.length ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No plans are published for this account type yet. Please check back shortly.
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((plan) => {
            const comingSoon = plan.status === "coming_soon";
            const free = plan.price === 0;
            return (
              <div key={plan.key} className="flex flex-col rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-semibold">{plan.label}</div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {comingSoon ? "Coming soon" : free ? "Free" : "Subscription"}
                  </span>
                </div>
                {plan.description ? <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p> : null}

                {comingSoon ? (
                  <p className="mt-4 text-sm text-muted-foreground">Details will be announced.</p>
                ) : (
                  <>
                    <div className="mt-4 text-2xl font-semibold">
                      {free ? "Free" : money(plan.price, plan.currency)}
                      {free ? null : <span className="text-sm font-normal text-muted-foreground"> / month</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {plan.includedCredits > 0
                        ? `${credits(plan.includedCredits)} included every month`
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
                    {free ? null : (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Billed monthly and renews automatically until cancelled. Cancel any time to stop future
                        renewals — you keep access to the end of the period you have paid for.
                      </p>
                    )}
                  </>
                )}

                <div className="mt-auto space-y-2 pt-5">
                  {comingSoon ? (
                    <Button className="w-full" variant="secondary" disabled>
                      Coming soon
                    </Button>
                  ) : (
                    <>
                      <Button className="w-full" onClick={() => setSelected(plan.key)}>
                        Select
                      </Button>
                      {selected === plan.key ? (
                        <div className="rounded-xl border border-border bg-background/50 p-3">
                          <p className="text-xs text-muted-foreground">
                            Create your {BRAND} account first. Create an account and verify your email before selecting
                            a plan.
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <Button size="sm" asChild>
                              <Link to={`/signup?plan=${encodeURIComponent(plan.key)}`}>Create account</Link>
                            </Button>
                            <Button size="sm" variant="secondary" asChild>
                              <Link to="/login?next=%2Fplans%2Fgateway">Log in</Link>
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}

                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card/60 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Wallet className="h-3.5 w-3.5" /> Buy credits without a subscription
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            One-time credit packages. Prices are shown before purchase and credits are valid for one year from the day
            you buy them.
          </p>
          {packs.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading credit prices…
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(packs.data?.packs ?? []).map((pack) => (
                <div key={pack.externalId} className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="text-lg font-semibold">{credits(pack.credits)}</div>
                  <div className="text-sm text-muted-foreground">{money(pack.price, pack.currency)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {money(pack.perCredit, pack.currency)} per credit
                  </div>
                  <Button className="mt-3 w-full" size="sm" variant="secondary" asChild>
                    <Link to="/login?next=%2Fplans">Log in to buy</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
          <PolicyLinks />
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card/60 p-5 text-sm text-muted-foreground">
          <p>
            Prices are shown in GBP and include any applicable tax calculated at checkout. Our order process is conducted
            by our online reseller Paddle.com, which is the Merchant of Record for all our orders and handles payment
            processing, payment support and applicable refunds.
          </p>
          <PolicyLinks />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
