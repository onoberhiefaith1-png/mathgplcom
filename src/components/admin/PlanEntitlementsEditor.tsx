import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { fetchPlanEntitlements, savePlanEntitlementsFn } from "@/lib/entitlements/entitlements.functions";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  LIMIT_LABEL,
  type EntitlementCategory,
  type LimitKey,
} from "@/lib/entitlements/features";

const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface/55";

const LIMIT_KEYS: LimitKey[] = ["max_classes", "max_students"];

/**
 * The plan's real access configuration. Every switch here is the same
 * entitlement the application checks, so turning one off removes the feature
 * from every account on this plan — no separate description to keep in step.
 */
export default function PlanEntitlementsEditor({
  planId,
  audience,
}: {
  planId: string;
  audience: string;
}) {
  const qc = useQueryClient();
  const fetchAll = useServerFn(fetchPlanEntitlements);
  const save = useServerFn(savePlanEntitlementsFn);

  const query = useQuery({
    queryKey: ["plan-entitlements"],
    queryFn: () => fetchAll(),
    staleTime: 60_000,
  });

  const catalogue = useMemo(
    () => (query.data?.catalogue ?? []).filter((f) => f.appliesTo.includes(audience)),
    [query.data, audience],
  );
  const saved = query.data?.map?.[planId] ?? null;

  const [selected, setSelected] = useState<string[]>([]);
  const [limits, setLimits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!query.data) return;
    setSelected(saved?.features ?? []);
    setLimits(
      Object.fromEntries(
        LIMIT_KEYS.map((k) => {
          const value = saved?.limits?.[k];
          return [k, value === null || value === undefined ? "" : String(value)];
        }),
      ),
    );
    // Re-seed only when the server view changes, so local edits are not lost.
  }, [query.data, planId]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          planId,
          features: selected,
          limits: Object.fromEntries(
            LIMIT_KEYS.map((k) => [k, limits[k]?.trim() ? Number(limits[k]) : null]),
          ),
        },
      }),
    onSuccess: () => {
      toast.success("Plan access saved — it applies to every account on this plan.");
      void qc.invalidateQueries({ queryKey: ["plan-entitlements"] });
      void qc.invalidateQueries({ queryKey: ["my-entitlements"] });
    },
    onError: (e: unknown) => toast.error(String((e as Error)?.message ?? "Could not save plan access.")),
  });

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => (on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));

  if (query.isLoading) {
    return (
      <div className="mt-4 flex items-center gap-2 text-xs text-dash-surface/60">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading plan access…
      </div>
    );
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: catalogue.filter((f) => f.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mt-5 rounded-2xl border border-dash-accent/25 bg-dash-surface/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={label}>Plan access · what this plan actually unlocks</div>
          <p className="mt-1 text-xs text-dash-surface/60">
            Each switch controls the live feature. Accounts on this plan gain or lose it immediately.
          </p>
        </div>
        <span className="rounded-full border border-dash-surface/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-surface/60">
          {selected.length} enabled
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {grouped.map(({ category, items }) => (
          <div key={category}>
            <div className={label}>{CATEGORY_LABEL[category as EntitlementCategory]}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {items.map((feature) => (
                <label
                  key={feature.key}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-dash-surface/15 bg-dash-surface/5 px-3 py-2"
                >
                  <span className="text-xs font-medium text-dash-surface/85">{feature.label}</span>
                  <Switch
                    checked={selected.includes(feature.key)}
                    onCheckedChange={(v) => toggle(feature.key, v)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className={label}>Limits · leave empty for unlimited</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {LIMIT_KEYS.map((key) => (
            <label key={key} className="rounded-xl border border-dash-surface/15 bg-dash-surface/5 p-3">
              <span className="text-xs font-medium text-dash-surface/85">{LIMIT_LABEL[key]}</span>
              <Input
                inputMode="numeric"
                placeholder="Unlimited"
                value={limits[key] ?? ""}
                onChange={(e) =>
                  setLimits((prev) => ({ ...prev, [key]: e.target.value.replace(/[^0-9]/g, "") }))
                }
                className="mt-1 h-10 border-dash-surface/20 bg-dash-surface/5 text-dash-surface"
              />
            </label>
          ))}
        </div>
      </div>

      <Button size="sm" className="mt-4 min-h-10" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        Save plan access
      </Button>
    </div>
  );
}
