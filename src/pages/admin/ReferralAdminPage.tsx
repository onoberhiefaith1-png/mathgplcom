import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, Plus } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import CampaignDialog, { type CampaignDraft } from "@/pages/referrals/CampaignDialog";
import {
  deleteReferralCampaign,
  listAdminReferralCampaigns,
  listReferralTargets,
  saveReferralCampaign,
  setReferralCampaignStatus,
} from "@/lib/referrals/referrals.functions";
import {
  audienceLabel,
  rewardRuleLabel,
  statusLabel,
  type AdminCampaign,
  type Campaign,
  type CampaignStatus,
  type ReferralTarget,
} from "@/lib/referrals/types";

const statusTone = (status: CampaignStatus) =>
  status === "live" ? "default" : status === "draft" ? "outline" : "secondary";

/**
 * The administrator's referral console. Every referral offer on MathGPL is
 * created, priced, targeted and published from here — nothing is offered to
 * anyone until an offer is set Live, so no reward amount exists by default.
 */
const ReferralAdminPage = () => {
  const { toast } = useToast();
  const load = useServerFn(listAdminReferralCampaigns);
  const loadTargets = useServerFn(listReferralTargets);
  const save = useServerFn(saveReferralCampaign);
  const setStatus = useServerFn(setReferralCampaignStatus);
  const remove = useServerFn(deleteReferralCampaign);

  const [rows, setRows] = useState<AdminCampaign[]>([]);
  const [targets, setTargets] = useState<ReferralTarget[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setRows((await load()).rows);
    } catch (error) {
      toast({
        title: "Could not load referral offers",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [load, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await loadTargets({ data: { search } });
        if (!cancelled) setTargets(result.rows);
      } catch {
        /* the picker is optional; an offer works with audiences alone */
      }
    };
    const timer = setTimeout(run, search ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadTargets, search]);

  const live = useMemo(() => rows.filter((row) => row.status === "live"), [rows]);

  const onSave = async (draft: CampaignDraft) => {
    setSaving(true);
    try {
      const amount = Number.parseFloat(draft.amount);
      await save({
        data: {
          id: draft.id,
          ownerKind: "platform",
          orgId: null,
          name: draft.name,
          rewardType: draft.rewardType,
          trigger: draft.trigger,
          isActive: draft.isActive,
          audience: draft.audience,
          status: draft.status,
          targetUserId: draft.targetUserId,
          rewardRule: {
            currency: draft.rewardType === "other" ? undefined : draft.currency,
            amount: draft.rewardType === "other" || Number.isNaN(amount) ? undefined : amount,
            discountKind: draft.rewardType === "discount" ? draft.discountKind : undefined,
            description: draft.rewardType === "other" ? draft.description : undefined,
          },
        },
      });
      setDialogOpen(false);
      await refresh();
      toast({ title: "Referral offer saved" });
    } catch (error) {
      toast({ title: "Could not save the offer", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const move = async (id: string, status: CampaignStatus) => {
    try {
      await setStatus({ data: { id, status } });
      await refresh();
      toast({ title: `Offer ${statusLabel(status).toLowerCase()}` });
    } catch (error) {
      toast({ title: "Could not update the offer", description: (error as Error).message, variant: "destructive" });
    }
  };

  const drop = async (id: string) => {
    try {
      await remove({ data: { id } });
      await refresh();
      toast({ title: "Offer deleted" });
    } catch (error) {
      toast({ title: "Could not delete the offer", description: (error as Error).message, variant: "destructive" });
    }
  };

  return (
    <DashboardShell
      title="Referrals"
      subtitle="Create every referral offer, decide its reward, and choose exactly who it is offered to. Nothing reaches a dashboard until you set it live."
      actions={
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-dash-gold px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dash-navy shadow-md transition hover:brightness-105"
        >
          <Plus className="h-3.5 w-3.5" /> New referral offer
        </button>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-dash-border bg-dash-surface/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Offers</div>
          <div className="text-2xl font-semibold tabular-nums">{rows.length}</div>
        </div>
        <div className="rounded-2xl border border-dash-border bg-dash-surface/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Live now</div>
          <div className="text-2xl font-semibold tabular-nums">{live.length}</div>
        </div>
        <div className="rounded-2xl border border-dash-border bg-dash-surface/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Rewards awaiting payment</div>
          <div className="text-2xl font-semibold tabular-nums">
            {rows.reduce((total, row) => total + row.pendingRewards, 0)}
          </div>
        </div>
      </div>

      <div className="mb-4 max-w-sm">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search accounts to assign an offer to…"
        />
      </div>

      {busy ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading referral offers…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-dash-border p-8 text-center">
          <Gift className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <div className="text-sm font-medium">No referral offer exists yet</div>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Until you create one and set it live, no reward amount is shown to anyone anywhere on MathGPL.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-dash-border bg-dash-surface/5 p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{row.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {rewardRuleLabel(row)} ·{" "}
                    {row.trigger === "registration" ? "earned on registration" : "earned on subscription"} ·{" "}
                    {row.ownerKind === "platform" ? "Platform offer" : `${row.ownerLabel} (${row.ownerKind})`}
                  </div>
                </div>
                <Badge variant={statusTone(row.status)} className="ml-auto shrink-0">
                  {statusLabel(row.status)}
                </Badge>
              </div>

              <div className="mt-3 rounded-xl border border-dash-border/60 p-3 text-xs">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Assigned to</div>
                <div className="mt-0.5">{row.targetLabel ?? audienceLabel(row.audience)}</div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  { label: "Referred", value: row.referred },
                  { label: "Subscribed", value: row.subscribed },
                  { label: "Pending", value: row.pendingRewards },
                  { label: "Settled", value: row.settledRewards },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-dash-border/60 p-2">
                    <div className="text-sm font-semibold tabular-nums">{stat.value}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(row);
                    setDialogOpen(true);
                  }}
                >
                  Edit
                </Button>
                {row.status === "live" ? (
                  <Button size="sm" variant="ghost" onClick={() => void move(row.id, "paused")}>
                    Pause
                  </Button>
                ) : row.status !== "retired" ? (
                  <Button size="sm" onClick={() => void move(row.id, "live")}>
                    Set live
                  </Button>
                ) : null}
                {row.status !== "retired" && (
                  <Button size="sm" variant="ghost" onClick={() => void move(row.id, "retired")}>
                    Retire
                  </Button>
                )}
                {row.referred === 0 && (
                  <Button size="sm" variant="ghost" onClick={() => void drop(row.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 max-w-2xl text-xs text-muted-foreground">
        Schools and teachers see the offer you assign to their role, and can also create their own offer so people can
        be referred to them. Their offer never replaces yours — both links work side by side.
      </p>

      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editing}
        scope="platform"
        saving={saving}
        onSave={onSave}
        targets={targets}
      />
    </DashboardShell>
  );
};

export default ReferralAdminPage;
