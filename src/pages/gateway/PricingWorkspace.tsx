import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Lock, Minus, Plus } from "lucide-react";

import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import { EmptyNote, RailCard } from "@/components/workspace/DashboardParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUsername } from "@/lib/accounts/useUsername";
import { GATEWAY_ITEMS, itemLabel, money, type GatewayItem, type GatewayOwnerKind } from "@/lib/gateway/items";
import type { GatewayPlan, PlanDraft } from "@/lib/gateway/gateway";
import { useGatewayStudents, useMyGatewayPlans, useSaveGatewayPlan } from "@/lib/gateway/useGateway";

type Drafts = Record<string, PlanDraft>;

const draftOf = (plan: GatewayPlan): PlanDraft => ({
  name: plan.name,
  description: plan.description,
  price: plan.price,
  items: plan.items,
  isPublished: plan.isPublished,
  autoGrantExisting: plan.autoGrantExisting,
});

/**
 * The Pricing workspace.
 *
 * One page, one idea: PLAN -> WHAT STUDENTS GET -> PRICE. The owner is not
 * selling credits and is not touching a platform subscription; they are deciding
 * what their own students receive and what they charge for it. Nothing here
 * edits the underlying platform features — only who may open them.
 */
const PricingWorkspace = ({ ownerKind }: { ownerKind: GatewayOwnerKind }) => {
  const { toast } = useToast();
  const { data: plans, isLoading, error } = useMyGatewayPlans(ownerKind);
  const { data: students } = useGatewayStudents(ownerKind);
  const save = useSaveGatewayPlan(ownerKind);
  const { username } = useUsername();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!plans) return;
    setDrafts((current) => {
      const next: Drafts = { ...current };
      for (const plan of plans) if (!next[plan.id]) next[plan.id] = draftOf(plan);
      return next;
    });
  }, [plans]);

  const gatewayPath = username ? `/g/${username}` : null;
  const gatewayUrl = useMemo(
    () => (gatewayPath && typeof window !== "undefined" ? `${window.location.origin}${gatewayPath}` : null),
    [gatewayPath],
  );

  const patch = (planId: string, change: Partial<PlanDraft>) =>
    setDrafts((current) => ({ ...current, [planId]: { ...current[planId], ...change } }));

  const toggleItem = (planId: string, item: GatewayItem) => {
    const draft = drafts[planId];
    if (!draft) return;
    patch(planId, {
      items: draft.items.includes(item) ? draft.items.filter((i) => i !== item) : [...draft.items, item],
    });
  };

  const submit = async (plan: GatewayPlan) => {
    const draft = drafts[plan.id];
    if (!draft) return;
    try {
      const { granted } = await save.mutateAsync({ plan, draft });
      toast({
        title: `${draft.name || "Plan"} saved`,
        description:
          granted > 0
            ? `${granted} connected student${granted === 1 ? "" : "s"} received this plan.`
            : draft.isPublished
              ? "Published on your gateway."
              : "Saved as a draft — students cannot see it yet.",
      });
    } catch (saveError) {
      toast({
        title: "Could not save the plan",
        description: saveError instanceof Error ? saveError.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const copyLink = async () => {
    if (!gatewayUrl) return;
    await navigator.clipboard.writeText(gatewayUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const rail = (
    <>
      <RailCard title="Your Gateway">
        {gatewayUrl ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Every student meets this page before your content — from your public link and after joining with your
              code.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-ws-border/70 bg-ws-panel/60 px-2 py-1.5 text-[11px]">
                {gatewayUrl}
              </code>
              <Button size="icon" variant="outline" onClick={() => void copyLink()} aria-label="Copy gateway link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <a href={gatewayPath!} target="_blank" rel="noreferrer">
                Open gateway <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        ) : (
          <EmptyNote>Choose a public username in your Account to get your gateway link.</EmptyNote>
        )}
      </RailCard>

      <RailCard title="Students on a plan">
        {!students || students.length === 0 ? (
          <EmptyNote>No student has chosen a plan yet.</EmptyNote>
        ) : (
          <ul className="space-y-1 text-sm">
            {(plans ?? []).map((plan) => (
              <li key={plan.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <span className="truncate">{plan.name}</span>
                <span className="shrink-0 font-semibold text-ws-gold">
                  {students.filter((entitlement) => entitlement.planId === plan.id).length}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RailCard>

      <RailCard title="Payments">
        <EmptyNote>
          Plan prices are yours. Connecting your own payment account so students pay you directly comes next — nothing
          is routed through MathGPL.
        </EmptyNote>
      </RailCard>
    </>
  );

  return (
    <WorkspaceLayout
      title="Pricing"
      subtitle={ownerKind === "school" ? "What your school gives students, and at what price" : "What your students get, and at what price"}
      rail={rail}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-ws-border/70 bg-ws-panel/50 p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Plan</span> → what students get →{" "}
            <span className="font-semibold text-foreground">price</span>. Publish a plan to show it on your gateway.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : isLoading || !plans ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your plans…
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const draft = drafts[plan.id] ?? draftOf(plan);
              return (
                <section
                  key={plan.id}
                  className="flex flex-col gap-4 rounded-2xl border border-ws-border/70 bg-ws-panel/60 p-4"
                >
                  <header className="space-y-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-ws-gold/80">
                      {plan.slot === "third" ? "Third plan" : plan.slot}
                    </span>
                    <Input
                      value={draft.name}
                      onChange={(event) => patch(plan.id, { name: event.target.value })}
                      aria-label="Plan name"
                      className="text-base font-semibold"
                    />
                    <Textarea
                      value={draft.description}
                      onChange={(event) => patch(plan.id, { description: event.target.value })}
                      placeholder="What this plan is for"
                      aria-label="Plan description"
                      rows={2}
                    />
                  </header>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      What students get
                    </span>
                    <ul className="space-y-1">
                      {GATEWAY_ITEMS.map((item) => {
                        const included = draft.items.includes(item.id);
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => toggleItem(plan.id, item.id)}
                              aria-pressed={included}
                              className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                                included
                                  ? "border-ws-gold/60 bg-ws-gold/10"
                                  : "border-ws-border/60 bg-transparent hover:border-ws-gold/40"
                              }`}
                            >
                              {included ? (
                                <Check className="h-4 w-4 text-ws-gold" />
                              ) : (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="truncate">{item.label}</span>
                              {included ? (
                                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                      htmlFor={`price-${plan.id}`}
                    >
                      Price (£)
                    </label>
                    <Input
                      id={`price-${plan.id}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.price ?? ""}
                      placeholder="0.00"
                      onChange={(event) =>
                        patch(plan.id, { price: event.target.value === "" ? null : Number(event.target.value) })
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {draft.price && draft.price > 0
                        ? `Students pay you ${money(draft.price, plan.currency)}.`
                        : "Free for students."}
                    </p>
                  </div>

                  <div className="space-y-2 border-t border-ws-border/50 pt-3">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>Published</span>
                      <Switch
                        checked={draft.isPublished}
                        onCheckedChange={(value) => patch(plan.id, { isPublished: value })}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        Give to existing students
                        <span className="block text-[11px] text-muted-foreground">
                          Students already connected keep access without visiting the gateway.
                        </span>
                      </span>
                      <Switch
                        checked={draft.autoGrantExisting}
                        onCheckedChange={(value) => patch(plan.id, { autoGrantExisting: value })}
                      />
                    </label>
                  </div>

                  <Button
                    onClick={() => void submit(plan)}
                    disabled={save.isPending}
                    className="w-full"
                  >
                    {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save plan
                  </Button>
                </section>
              );
            })}
          </div>
        )}

        {plans && plans.length > 0 ? (
          <div className="rounded-2xl border border-ws-border/70 bg-ws-panel/40 p-4">
            <h2 className="text-sm font-semibold">What a student sees</h2>
            <ul className="mt-3 grid gap-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const draft = drafts[plan.id] ?? draftOf(plan);
                return (
                  <li key={plan.id} className="rounded-xl border border-ws-border/60 p-3 text-sm">
                    <span className="block font-semibold">{draft.name || "Plan"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {draft.items.length === 0 ? "No items yet" : draft.items.map(itemLabel).join(" · ")}
                    </span>
                    <span className="mt-1 block font-semibold text-ws-gold">
                      {money(draft.price ?? 0, plan.currency)}
                      {draft.isPublished ? "" : " · draft"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </WorkspaceLayout>
  );
};

export default PricingWorkspace;
