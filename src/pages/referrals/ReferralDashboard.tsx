import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgePoundSterling, Check, Copy, Gift, Plus, Share2, TrendingUp, UserPlus, Users } from "lucide-react";

import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import DashboardHero from "@/components/workspace/DashboardHero";
import { EmptyNote, RailCard, StatCard } from "@/components/workspace/DashboardParts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import CampaignDialog, { type CampaignDraft } from "@/pages/referrals/CampaignDialog";
import {
  markReferralRewardPaid,
  saveReferralCampaign,
  setReferralCampaignActive,
} from "@/lib/referrals/referrals.functions";
import { useReferralAccess, useReferralDashboard, useReferralRefresh, SCOPE_LABEL } from "@/lib/referrals/useReferrals";
import {
  ACTIVITY_FILTERS,
  formatMoney,
  referralMessage,
  rewardRuleLabel,
  type ActivityFilter,
  type Campaign,
  type CurrencyTotal,
  type ReferralRow,
} from "@/lib/referrals/types";

const MoneyLine = ({ totals, empty }: { totals: CurrencyTotal[]; empty: string }) =>
  totals.length === 0 ? (
    <span className="text-sm text-muted-foreground">{empty}</span>
  ) : (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {totals.map((total) => (
        <span key={total.currency} className="text-lg font-semibold tabular-nums">
          {formatMoney(total.amount, total.currency)}
        </span>
      ))}
    </span>
  );

const statusBadge = (row: ReferralRow) => {
  if (row.status === "paid") return <Badge variant="secondary">Completed</Badge>;
  if (row.status === "eligible") return <Badge>Eligible</Badge>;
  return <Badge variant="outline">Pending</Badge>;
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

/**
 * One dashboard, three scopes. A teacher sees their own referrals, a school
 * sees the referrals made inside the school, and the platform administrator
 * sees everything plus the campaigns that define the reward rules.
 */
const ReferralDashboard = () => {
  const { toast } = useToast();
  const { scope, orgId } = useReferralAccess();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const { data, isLoading } = useReferralDashboard(filter);
  const refresh = useReferralRefresh();

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = useServerFn(saveReferralCampaign);
  const toggle = useServerFn(setReferralCampaignActive);
  const markPaid = useServerFn(markReferralRewardPaid);

  const overview = data?.overview;
  const link = data?.link;
  const canConfigure = scope === "platform" || scope === "school" || scope === "teacher";
  const canSettle = scope === "platform" || scope === "school";

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const shareLink = async () => {
    if (!link) return;
    const share = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
    if (share) {
      try {
        await share.call(navigator, { title: "Join MathGPL", url: link.url });
        return;
      } catch {
        /* the person closed the share sheet */
      }
    }
    void copyLink();
  };

  const onSave = async (draft: CampaignDraft) => {
    if (!scope) return;
    setSaving(true);
    try {
      const amount = Number.parseFloat(draft.amount);
      await save({
        data: {
          id: draft.id,
          ownerKind: scope,
          orgId,
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
      refresh();
      toast({ title: "Campaign saved" });
    } catch (error) {
      toast({ title: "Could not save campaign", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const rail = (
    <>
      <RailCard title="Rewards">
        <div className="space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total earned</div>
            <MoneyLine totals={overview?.earned ?? []} empty="No cash reward yet" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pending</div>
            <MoneyLine totals={overview?.pending ?? []} empty="Nothing pending" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Payment recorded</div>
            <MoneyLine totals={overview?.paid ?? []} empty="Nothing recorded yet" />
          </div>
          {(overview?.nonCashRewards ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              {overview?.nonCashRewards} non-cash reward{overview?.nonCashRewards === 1 ? "" : "s"} earned.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            MathGPL records the reward. Payment itself is made outside the platform and then marked as completed.
          </p>
        </div>
      </RailCard>

      {scope !== "teacher" && (
        <RailCard title="Top referrers">
          {(data?.topReferrers ?? []).length === 0 ? (
            <EmptyNote>No referral has been attributed yet.</EmptyNote>
          ) : (
            <ul className="space-y-2">
              {data!.topReferrers.map((referrer) => (
                <li
                  key={referrer.referrerUserId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-border/50 p-3 text-sm"
                >
                  <span className="truncate">{referrer.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {referrer.subscribed}/{referrer.registered}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RailCard>
      )}
    </>
  );

  if (!scope) {
    return (
      <WorkspaceLayout title="Refer & Earn" subtitle="Referral & rewards">
        <EmptyNote>Referral is available to platform administrators, schools and teachers.</EmptyNote>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout title="Refer & Earn" subtitle={SCOPE_LABEL[scope]} rail={rail}>
      <DashboardHero blurb="Share your link, and MathGPL tracks the whole journey — registration, subscription, eligibility and reward." />

      <section className="mt-4 rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Your referral link
        </div>
        {link ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input readOnly value={link.url} className="min-w-[220px] flex-1 font-mono text-xs" />
            <Button variant="secondary" onClick={copyLink}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} Copy link
            </Button>
            <Button variant="ghost" onClick={shareLink}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
          </div>
        ) : (
          <EmptyNote>
            {isLoading ? "Preparing your link…" : "No referral programme is running for you yet, so no reward and no link can be shown."}
          </EmptyNote>
        )}
        {data?.campaign && (
          <p className="mt-2 text-xs text-muted-foreground">
            {data.campaign.name} — {rewardRuleLabel(data.campaign)} per referral,{" "}
            {data.campaign.trigger === "registration" ? "earned on registration" : "earned on subscription"}.
          </p>
        )}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Referred" value={overview?.referred ?? 0} icon={UserPlus} loading={isLoading} />
        <StatCard label="Registered" value={overview?.registered ?? 0} icon={Users} loading={isLoading} />
        <StatCard label="Subscribed" value={overview?.subscribed ?? 0} icon={BadgePoundSterling} loading={isLoading} />
        <StatCard label="Eligible" value={overview?.eligible ?? 0} icon={Gift} loading={isLoading} />
        <StatCard
          label="Registered → subscribed"
          value={overview?.conversionRate ?? 0}
          suffix="%"
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Referral activity
          </h2>
          {ACTIVITY_FILTERS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={filter === option.value ? "default" : "ghost"}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {(data?.rows ?? []).length === 0 ? (
          <EmptyNote>
            {isLoading ? "Loading referral activity…" : "No referral matches this view yet."}
          </EmptyNote>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Referral</th>
                  <th className="px-3 py-2">Registered</th>
                  <th className="px-3 py-2">Subscribed</th>
                  <th className="px-3 py-2">Reward status</th>
                  <th className="px-3 py-2">Reward</th>
                  {canSettle && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {data!.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/50">
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.label}</div>
                      <div className="text-xs text-muted-foreground">{referralMessage(row)}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{when(row.registeredAt)}</td>
                    <td className="px-3 py-2 text-xs">{row.subscribedAt ? when(row.subscribedAt) : "—"}</td>
                    <td className="px-3 py-2">{statusBadge(row)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.rewardLabel}</td>
                    {canSettle && (
                      <td className="px-3 py-2 text-right">
                        {row.status === "eligible" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              try {
                                await markPaid({ data: { id: row.id, note: null } });
                                refresh();
                                toast({ title: "Payment recorded" });
                              } catch (error) {
                                toast({
                                  title: "Could not record payment",
                                  description: (error as Error).message,
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Mark paid
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canConfigure && (
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="mr-auto text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Reward configuration
            </h2>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New campaign
            </Button>
          </div>

          {(data?.campaigns ?? []).length === 0 ? (
            <EmptyNote>No campaign yet. Create one to define the reward and when it is earned.</EmptyNote>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {data!.campaigns.map((campaign) => (
                <li key={campaign.id} className="rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{campaign.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {rewardRuleLabel(campaign)} ·{" "}
                        {campaign.trigger === "registration" ? "on registration" : "on subscription"} ·{" "}
                        {campaign.ownerKind}
                      </div>
                    </div>
                    <Badge variant={campaign.status === "live" ? "default" : "outline"} className="ml-auto shrink-0">
                      {statusLabel(campaign.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(campaign);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await toggle({ data: { id: campaign.id, isActive: !campaign.isActive } });
                          refresh();
                        } catch (error) {
                          toast({
                            title: "Could not update campaign",
                            description: (error as Error).message,
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      {campaign.isActive ? "Pause" : "Activate"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editing}
        scope={scope}
        saving={saving}
        onSave={onSave}
      />
    </WorkspaceLayout>
  );
};

export default ReferralDashboard;
