import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { credits, money } from "@/lib/costs/categories";
import {
  fetchCreditInventory,
  fetchStaffCodes,
  saveCreditPurchase,
  saveStaffCodeFn,
} from "@/lib/costs/costs.functions";

const card = "rounded-2xl border border-dash-surface/15 bg-dash-surface/5 p-5";
const heading = "text-sm font-semibold uppercase tracking-[0.14em] text-dash-accent";
const label = "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface/55";

/**
 * The platform's own credit economy: credits bought upstream, the price they
 * are sold at, the plans derived from that price, and staff entitlement.
 * Nothing here is a customer-facing figure.
 */
export default function CreditEconomyPanel() {
  const qc = useQueryClient();

  const inventory = useQuery({ queryKey: ["credit-inventory"], queryFn: () => fetchCreditInventory({}) });
  const staff = useQuery({ queryKey: ["staff-codes"], queryFn: () => fetchStaffCodes({}) });

  const [purchase, setPurchase] = useState({ credits: "", unitCost: "", note: "" });
  const [codeDraft, setCodeDraft] = useState({ code: "", label: "", entitlement: "pro" });

  const inv = inventory.data?.inventory;

  const addPurchase = useMutation({
    mutationFn: (input: { credits: number; unitCost: number; note?: string }) =>
      saveCreditPurchase({ data: input }),
    onSuccess: () => {
      setPurchase({ credits: "", unitCost: "", note: "" });
      qc.invalidateQueries({ queryKey: ["credit-inventory"] });
      toast.success("Credit purchase recorded.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCode = useMutation({
    mutationFn: (input: { code: string; label?: string; entitlement: string; active: boolean }) =>
      saveStaffCodeFn({ data: input }),
    onSuccess: () => {
      setCodeDraft({ code: "", label: "", entitlement: "pro" });
      qc.invalidateQueries({ queryKey: ["staff-codes"] });
      toast.success("Staff code saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Inventory */}
      <section className={card}>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-dash-accent" />
          <h2 className={heading}>Platform credit inventory</h2>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
          Credits bought upstream are the platform's stock and its real cost. Consumption is read from metered usage, so
          the remaining balance is measured, never estimated.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-dash-surface/10 pt-4">
          <div>
            <p className={label}>Credits bought</p>
            <Input
              inputMode="decimal"
              className="mt-1 h-9 w-32"
              placeholder="1000"
              value={purchase.credits}
              onChange={(e) => setPurchase({ ...purchase, credits: e.target.value })}
            />
          </div>
          <div>
            <p className={label}>Cost per credit</p>
            <Input
              inputMode="decimal"
              className="mt-1 h-9 w-28"
              placeholder="0.31"
              value={purchase.unitCost}
              onChange={(e) => setPurchase({ ...purchase, unitCost: e.target.value })}
            />
          </div>
          <div className="min-w-48 flex-1">
            <p className={label}>Note</p>
            <Input
              className="mt-1 h-9"
              placeholder="Invoice reference"
              value={purchase.note}
              onChange={(e) => setPurchase({ ...purchase, note: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            disabled={addPurchase.isPending}
            onClick={() => {
              const c = Number(purchase.credits);
              const u = Number(purchase.unitCost);
              if (!(c > 0) || !Number.isFinite(u)) return toast.error("Enter the credits bought and their cost.");
              addPurchase.mutate({ credits: c, unitCost: u, note: purchase.note || undefined });
            }}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" /> Record purchase
          </Button>
        </div>

        {(inv?.purchases ?? []).length > 0 && (
          <div className="mt-4 space-y-1 border-t border-dash-surface/10 pt-3">
            {(inv?.purchases ?? []).slice(0, 6).map((p) => (
              <p key={p.id} className="text-xs text-dash-surface/70">
                {new Date(p.purchasedAt).toLocaleDateString("en-GB")} — {credits(p.credits)} at{" "}
                {money(p.unitCost, p.currency)} each = {money(p.credits * p.unitCost, p.currency)}
                {p.note ? ` · ${p.note}` : ""}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Staff codes */}
      <section className={card}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-dash-accent" />
          <h2 className={heading}>Staff access codes</h2>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-dash-surface/65">
          Staff access is not a promotion. A staff code grants entitlement with no checkout, and the usage it creates is
          still recorded at full platform cost so it reads as a measured internal expense.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <p className={label}>Code</p>
            <Input
              className="mt-1 h-9 w-40"
              placeholder="MATHGPL-STAFF"
              value={codeDraft.code}
              onChange={(e) => setCodeDraft({ ...codeDraft, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="min-w-40 flex-1">
            <p className={label}>Label</p>
            <Input
              className="mt-1 h-9"
              placeholder="Internal team"
              value={codeDraft.label}
              onChange={(e) => setCodeDraft({ ...codeDraft, label: e.target.value })}
            />
          </div>
          <div>
            <p className={label}>Entitlement</p>
            <Input
              className="mt-1 h-9 w-28"
              value={codeDraft.entitlement}
              onChange={(e) => setCodeDraft({ ...codeDraft, entitlement: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            disabled={saveCode.isPending}
            onClick={() => {
              if (codeDraft.code.trim().length < 2) return toast.error("Enter a code.");
              saveCode.mutate({
                code: codeDraft.code,
                label: codeDraft.label || undefined,
                entitlement: codeDraft.entitlement || "pro",
                active: true,
              });
            }}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save code
          </Button>
        </div>

        <div className="mt-4 space-y-2 border-t border-dash-surface/10 pt-3">
          {(staff.data?.rows ?? []).length === 0 ? (
            <p className="text-xs text-dash-surface/55">No staff code created yet.</p>
          ) : (
            (staff.data?.rows ?? []).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-dash-surface">
                  <span className="font-mono">{c.code}</span>
                  <span className="ml-2 text-xs text-dash-surface/65">
                    {c.label ?? "Staff"} · {c.entitlement} · {c.redemptions} in use
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dash-surface/60">{c.active ? "Active" : "Disabled"}</span>
                  <Switch
                    checked={c.active}
                    onCheckedChange={(v) =>
                      saveCode.mutate({
                        code: c.code,
                        label: c.label ?? undefined,
                        entitlement: c.entitlement,
                        active: v,
                      })
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
