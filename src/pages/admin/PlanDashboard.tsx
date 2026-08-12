import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { CheckCircle2, Layers, Loader2, RotateCcw, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { credits, money } from "@/lib/costs/categories";
import { AUDIENCE_LABEL, SUBSCRIBING_AUDIENCES } from "@/lib/costs/pricing";
import { includedCredits, sellPrice } from "@/lib/costs/pricing";
import {
  discardPlanDraftFn,
  fetchPaymentCatalogStatus,
  fetchPlanDashboard,
  publishPlanFn,
  savePlanDraftFn,
  savePlanFeaturesFn,
  savePlanPresentationFn,
  syncPaymentCatalogFn,
} from "@/lib/plans/plans.functions";

import type { PlanRecord } from "@/lib/plans/plans.server";

const card = "rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5";
const heading = "text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent";
const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface/55";
const chip =
  "inline-flex items-center gap-1 rounded-full border border-dash-surface/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]";

type Draft = { label: string; description: string; platform: string; credit: string; features: string };

/**
 * Read-only view of what checkout is charging against what the published plans
 * say. Nothing here is editable: "Published" is derived from the live plan
 * version and "At checkout" is read from the payment provider. The only action
 * is re-running the push publishing already performs.
 */
function CatalogEnvironment({ environment }: { environment: "sandbox" | "live" }) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["payment-catalog", environment],
    queryFn: () => fetchPaymentCatalogStatus({ data: { environment } }),
  });
  const sync = useMutation({
    mutationFn: () => syncPaymentCatalogFn({ data: { environment } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["payment-catalog"] });
      toast.success(
        r.updated.length ? `Updated ${r.updated.length} price(s) at checkout.` : "Everything already matches.",
      );
      if (r.missing.length) toast.warning(`Not yet created at checkout: ${r.missing.join(", ")}`);
      if (r.failed.length) toast.error(`Could not update: ${r.failed.map((f) => f.externalId).join(", ")}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = status.data?.rows ?? [];
  const outOfSync = rows.filter((r) => !r.inSync);

  return (
    <div className="mt-4 first:mt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={chip}>{environment === "sandbox" ? "Test" : "Live"}</span>
          <span className="text-xs text-dash-surface/60">
            {status.isLoading
              ? "Checking checkout…"
              : outOfSync.length
                ? `${outOfSync.length} price(s) differ from your published amounts.`
                : "Checkout is charging exactly your published amounts."}
          </span>
        </div>
        <Button size="sm" variant="secondary" disabled={sync.isPending} onClick={() => sync.mutate()}>
          {sync.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Push prices to checkout
        </Button>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className={label}>
            <tr>
              <th className="py-2">Item</th>
              <th className="py-2">Published (read-only)</th>
              <th className="py-2">At checkout (read-only)</th>
              <th className="py-2">State</th>
            </tr>
          </thead>
          <tbody className="text-dash-surface/85">
            {rows.map((r) => (
              <tr
                key={`${r.environment}-${r.externalId}`}
                className={`border-t border-dash-surface/10 ${r.inSync ? "" : "bg-amber-500/10"}`}
              >
                <td className="py-2">
                  {r.label}
                  <span className="ml-2 text-[11px] text-dash-surface/45">{r.externalId}</span>
                </td>
                <td className="py-2">{money(r.expected, r.currency)}</td>
                <td className="py-2">{r.provider === null ? "—" : money(r.provider, r.currency)}</td>
                <td className="py-2">
                  {r.inSync ? (
                    <span className={chip}>In sync</span>
                  ) : r.missing ? (
                    <span className={`${chip} border-amber-400/40 text-amber-200`}>Not created at checkout</span>
                  ) : (
                    <span className={`${chip} border-amber-400/40 text-amber-200`}>
                      Out of sync — checkout charges {money(r.provider ?? 0, r.currency)}, published{" "}
                      {money(r.expected, r.currency)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatalogPipeline() {
  return (
    <section className={`${card} mt-4`}>
      <h2 className={heading}>Pricing pipeline</h2>
      <p className="mt-2 text-xs text-dash-surface/60">
        A read-only reflection of the published plans. Prices are edited in the plan cards below and pushed here
        automatically when you publish a version.
      </p>
      <CatalogEnvironment environment="sandbox" />
      <CatalogEnvironment environment="live" />
    </section>
  );
}



/**
 * Plan control centre. The administrator edits the money split; the included
 * credits are always derived from the live credit sell price. An edit stays a
 * draft until it is published as the next version, and subscriptions keep the
 * version they were created from.
 */
export default function PlanDashboard() {
  const qc = useQueryClient();
  const dashboard = useQuery({ queryKey: ["plan-dashboard"], queryFn: () => fetchPlanDashboard({}) });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const plans = dashboard.data?.plans ?? [];
  const base = dashboard.data?.base;
  const overview = dashboard.data?.overview;

  useEffect(() => {
    if (!plans.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const p of plans) {
        if (next[p.id]) continue;
        const source = p.draft ?? p.live;
        next[p.id] = {
          label: source?.label ?? p.label,
          description: source?.description ?? p.description ?? "",
          platform: String(source?.platformAmount ?? 0),
          credit: String(source?.creditAmount ?? 0),
          features: p.features.join("\n"),
        };
      }
      return next;
    });
  }, [plans]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["plan-dashboard"] });

  const saveDraft = useMutation({
    mutationFn: (input: {
      planId: string;
      label: string;
      description: string;
      platformAmount: number;
      creditAmount: number;
    }) => savePlanDraftFn({ data: input }),
    onSuccess: () => {
      refresh();
      toast.success("Draft saved. Nothing customer-facing has changed yet.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: (planId: string) => publishPlanFn({ data: { planId } }),
    onSuccess: (r) => {
      refresh();
      qc.invalidateQueries({ queryKey: ["payment-catalog"] });
      const failed = (r.sync ?? []).flatMap((s) => s.failed);
      const missing = (r.sync ?? []).flatMap((s) => s.missing);
      toast.success("Published. New subscribers get this version; existing ones keep theirs.");
      if (failed.length) {
        toast.error("Published, but checkout still shows the old amount — press “Push prices to checkout”.");
      } else if (missing.length) {
        toast.warning(`Not yet created at checkout: ${[...new Set(missing)].join(", ")}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const discard = useMutation({
    mutationFn: (planId: string) => discardPlanDraftFn({ data: { planId } }),
    onSuccess: () => {
      refresh();
      toast.success("Draft discarded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePresentation = useMutation({
    mutationFn: (input: { planId: string; status: "available" | "coming_soon"; visible: boolean; active: boolean }) =>
      savePlanPresentationFn({ data: input }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveFeatures = useMutation({
    mutationFn: (input: { planId: string; features: string[] }) => savePlanFeaturesFn({ data: input }),
    onSuccess: () => {
      refresh();
      toast.success("Plan features saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(
    () =>
      SUBSCRIBING_AUDIENCES.map((audience) => ({
        audience,
        plans: plans.filter((p) => p.audience === audience),
      })),
    [plans],
  );

  const derived = (d: Draft | undefined) => {
    const platform = Number(d?.platform ?? 0) || 0;
    const credit = Number(d?.credit ?? 0) || 0;
    const cost = base?.costPrice ?? 0;
    const pct = base?.profitPercentage ?? 0;
    return {
      platform,
      credit,
      total: platform + credit,
      sell: sellPrice(cost, pct),
      credits: includedCredits(credit, cost, pct),
    };
  };

  return (
    <DashboardShell
      title="Plans"
      subtitle="Plan prices, their platform/credit split and the credits they include. Included credits are derived from the live credit sell price — publish to make a change live, and existing subscriptions keep the version they started on."
      actions={
        <>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface transition hover:bg-dash-surface/20"
          >
            Platform
          </Link>
          <Link
            to="/admin/credits"
            className="inline-flex items-center gap-2 rounded-full border border-dash-surface/25 bg-dash-surface/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-surface transition hover:bg-dash-surface/20"
          >
            Pricing engine
          </Link>
        </>
      }
    >
      {dashboard.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-dash-surface/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
        </div>
      ) : null}

      {/* Live economics */}
      <section className={card}>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-dash-accent" />
          <h2 className={heading}>Live economics</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Credit cost price · input", money(base?.costPrice ?? 0, base?.currency ?? "GBP")],
            ["Profit percentage · input", `${base?.profitPercentage ?? 0}%`],
            [
              "Credit sell price · derived",
              `${money(base?.sellPrice ?? 0, base?.currency ?? "GBP")}  (exact ${(base?.sellPrice ?? 0).toFixed(4)})`,
            ],
            ["Active subscriptions", String(overview?.activeCount ?? 0)],
            ["Monthly plan revenue", money(overview?.monthlyRevenue ?? 0)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-dash-surface/15 bg-dash-surface/5 p-3">
              <div className={label}>{k}</div>
              <div className="mt-1 text-lg font-semibold text-dash-surface">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-dash-surface/60">
          Credit cost price and profit percentage are the only editable inputs (set them in the pricing engine). Credit
          sell price = cost × (1 + profit ÷ 100). Credits allocated to subscribers so far:{" "}
          {credits(overview?.allocatedCredits ?? 0)}. Collected payments: {money(overview?.collected ?? 0)}.
        </p>

      </section>

      <CatalogPipeline />



      {grouped.map(({ audience, plans: list }) => (
        <section key={audience} className="mt-4">
          <h2 className={heading}>{AUDIENCE_LABEL[audience]} plans</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {list.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                draft={drafts[plan.id]}
                derived={derived(drafts[plan.id])}
                busy={saveDraft.isPending || publish.isPending}
                onChange={(patch) =>
                  setDrafts((prev) => ({ ...prev, [plan.id]: { ...prev[plan.id]!, ...patch } }))
                }
                onSaveDraft={() => {
                  const d = drafts[plan.id];
                  if (!d) return;
                  saveDraft.mutate({
                    planId: plan.id,
                    label: d.label,
                    description: d.description,
                    platformAmount: Number(d.platform) || 0,
                    creditAmount: Number(d.credit) || 0,
                  });
                }}
                onPublish={() => publish.mutate(plan.id)}
                onDiscard={() => discard.mutate(plan.id)}
                onSaveFeatures={() =>
                  saveFeatures.mutate({
                    planId: plan.id,
                    features: (drafts[plan.id]?.features ?? "").split("\n").map((l) => l.trim()).filter(Boolean),
                  })
                }
                onPresentation={(patch) =>
                  savePresentation.mutate({
                    planId: plan.id,
                    status: patch.status ?? plan.status,
                    visible: patch.visible ?? plan.visible,
                    active: patch.active ?? plan.active,
                  })
                }
              />
            ))}
          </div>
        </section>
      ))}

      {/* Subscriptions by plan */}
      <section className={`${card} mt-4`}>
        <h2 className={heading}>Subscriptions by plan</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={label}>
              <tr>
                <th className="py-2">Plan</th>
                <th className="py-2">Active</th>
                <th className="py-2">Monthly revenue</th>
                <th className="py-2">Credits allocated</th>
              </tr>
            </thead>
            <tbody className="text-dash-surface/85">
              {(overview?.byPlan ?? []).map((r) => (
                <tr key={r.planKey} className="border-t border-dash-surface/10">
                  <td className="py-2">{r.planKey}</td>
                  <td className="py-2">{r.active}</td>
                  <td className="py-2">{money(r.revenue)}</td>
                  <td className="py-2">{credits(r.credits)}</td>
                </tr>
              ))}
              {!overview?.byPlan.length ? (
                <tr>
                  <td colSpan={4} className="py-3 text-xs text-dash-surface/55">
                    No subscriptions yet. Rows appear as soon as a plan is started.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}

function PlanCard({
  plan,
  draft,
  derived,
  busy,
  onChange,
  onSaveDraft,
  onPublish,
  onDiscard,
  onSaveFeatures,
  onPresentation,
}: {
  plan: PlanRecord;
  draft: Draft | undefined;
  derived: { platform: number; credit: number; total: number; sell: number; credits: number };
  busy: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onDiscard: () => void;
  onSaveFeatures: () => void;
  onPresentation: (patch: { status?: "available" | "coming_soon"; visible?: boolean; active?: boolean }) => void;
}) {
  const live = plan.live;
  const changed =
    !!plan.draft &&
    (plan.draft.platformAmount !== (live?.platformAmount ?? 0) ||
      plan.draft.creditAmount !== (live?.creditAmount ?? 0) ||
      plan.draft.label !== (live?.label ?? plan.label));

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-dash-surface">{plan.label}</div>
          <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-dash-surface/50">{plan.key}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`${chip} text-dash-surface/70`}>v{live?.versionNo ?? 0} live</span>
          {plan.status === "coming_soon" ? (
            <span className={`${chip} text-dash-accent`}>Coming soon</span>
          ) : null}
          {changed ? <span className={`${chip} text-amber-300`}>Draft pending</span> : null}
        </div>
      </div>

      {/* Money split */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div>
          <div className={label}>Plan name</div>
          <Input value={draft?.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} />
        </div>
        <div>
          <div className={label}>Short description</div>
          <Input value={draft?.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
        </div>
        <div>
          <div className={label}>Platform amount ({plan.currency})</div>
          <Input
            inputMode="decimal"
            value={draft?.platform ?? ""}
            onChange={(e) => onChange({ platform: e.target.value })}
          />
        </div>
        <div>
          <div className={label}>Credit budget ({plan.currency})</div>
          <Input
            inputMode="decimal"
            value={draft?.credit ?? ""}
            onChange={(e) => onChange({ credit: e.target.value })}
          />
        </div>
      </div>

      {/* Derived preview */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          ["Customer price · derived", money(derived.total, plan.currency)],
          ["Credit sell price · derived", money(derived.sell, plan.currency)],
          ["Included credits · derived", credits(derived.credits)],

        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-dash-surface/15 bg-dash-surface/5 p-3">
            <div className={label}>{k}</div>
            <div className="mt-1 text-sm font-semibold text-dash-surface">{v}</div>
          </div>
        ))}
      </div>

      {live ? (
        <p className="mt-2 text-xs text-dash-surface/60">
          Live now: {money(live.price, live.currency)} — {money(live.platformAmount, live.currency)} platform +{" "}
          {money(live.creditAmount, live.currency)} credits, {credits(live.includedCredits)} at{" "}
          {live.profitPercentage}% profit.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onSaveDraft} disabled={busy}>
          <Save className="mr-1.5 h-3.5 w-3.5" /> Save draft
        </Button>
        <Button size="sm" variant="secondary" onClick={onPublish} disabled={busy || !plan.draft}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Publish version
        </Button>
        {plan.draft ? (
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Discard draft
          </Button>
        ) : null}
      </div>

      {/* Features */}
      <div className="mt-4">
        <div className={label}>What this plan includes (one per line)</div>
        <textarea
          value={draft?.features ?? ""}
          onChange={(e) => onChange({ features: e.target.value })}
          rows={4}
          className="mt-1 w-full rounded-xl border border-dash-surface/20 bg-dash-surface/5 p-2 text-sm text-dash-surface outline-none focus:border-dash-accent/60"
        />
        <Button size="sm" variant="ghost" className="mt-2" onClick={onSaveFeatures}>
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Save features
        </Button>
      </div>

      {/* Presentation */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="flex items-center justify-between gap-2 rounded-xl border border-dash-surface/15 bg-dash-surface/5 p-3">
          <span className={label}>Coming soon</span>
          <Switch
            checked={plan.status === "coming_soon"}
            onCheckedChange={(v) => onPresentation({ status: v ? "coming_soon" : "available" })}
          />
        </label>
        <label className="flex items-center justify-between gap-2 rounded-xl border border-dash-surface/15 bg-dash-surface/5 p-3">
          <span className={label}>Shown to customers</span>
          <Switch checked={plan.visible} onCheckedChange={(v) => onPresentation({ visible: v })} />
        </label>
        <label className="flex items-center justify-between gap-2 rounded-xl border border-dash-surface/15 bg-dash-surface/5 p-3">
          <span className={label}>Active</span>
          <Switch checked={plan.active} onCheckedChange={(v) => onPresentation({ active: v })} />
        </label>
      </div>

      {/* Version history */}
      {plan.history.length ? (
        <div className="mt-4">
          <div className={label}>Version history</div>
          <ul className="mt-1 space-y-1 text-xs text-dash-surface/70">
            {plan.history.slice(0, 6).map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-dash-surface/85">v{v.versionNo}</span>
                <span>{money(v.price, v.currency)}</span>
                <span>{credits(v.includedCredits)}</span>
                <span>{v.profitPercentage}% profit</span>
                <span className="text-dash-surface/45">
                  {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : "—"}
                </span>
                {v.status === "published" ? <span className={`${chip} text-emerald-300`}>Current</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
