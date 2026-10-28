import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AUDIENCE_OPTIONS,
  CAMPAIGN_STATUSES,
  CURRENCIES,
  REWARD_TYPES,
  TRIGGERS,
  type AudienceRole,
  type Campaign,
  type CampaignStatus,
  type DiscountKind,
  type ReferralScope,
  type ReferralTarget,
  type RewardType,
  type TriggerEvent,
} from "@/lib/referrals/types";

export type CampaignDraft = {
  id?: string;
  name: string;
  rewardType: RewardType;
  currency: string;
  amount: string;
  discountKind: DiscountKind;
  description: string;
  trigger: TriggerEvent;
  isActive: boolean;
  audience: AudienceRole[];
  status: CampaignStatus;
  targetUserId: string | null;
};

const draftFrom = (campaign?: Campaign | null): CampaignDraft => ({
  id: campaign?.id,
  name: campaign?.name ?? "Referral campaign",
  rewardType: campaign?.rewardType ?? "payment",
  currency: campaign?.rewardRule?.currency ?? "GBP",
  amount: campaign?.rewardRule?.amount != null ? String(campaign.rewardRule.amount) : "",
  discountKind: campaign?.rewardRule?.discountKind ?? "percentage",
  description: campaign?.rewardRule?.description ?? "",
  trigger: campaign?.trigger ?? "subscription",
  isActive: campaign?.isActive ?? true,
  audience: campaign?.audience ?? [],
  status: campaign?.status ?? "draft",
  targetUserId: campaign?.targetUserId ?? null,
});

/**
 * The reward is answered in three questions — what, how much, and when it is
 * earned. Everything else (tracking, totals, eligibility) is the engine's job.
 */
const CampaignDialog = ({
  open,
  onOpenChange,
  campaign,
  scope,
  saving,
  onSave,
  targets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: Campaign | null;
  scope: ReferralScope;
  saving?: boolean;
  onSave: (draft: CampaignDraft) => void;
  /** Administrator only: the accounts an offer may be assigned to directly. */
  targets?: ReferralTarget[];
}) => {
  const [draft, setDraft] = useState<CampaignDraft>(() => draftFrom(campaign));
  useEffect(() => {
    if (open) setDraft(draftFrom(campaign));
  }, [open, campaign]);

  const patch = (next: Partial<CampaignDraft>) => setDraft((d) => ({ ...d, ...next }));
  const money = draft.rewardType === "payment" || (draft.rewardType === "discount" && draft.discountKind === "fixed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New referral campaign"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="MathGPL Referral Campaign"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Reward type</Label>
            <Select value={draft.rewardType} onValueChange={(value) => patch({ rewardType: value as RewardType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REWARD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {REWARD_TYPES.find((t) => t.value === draft.rewardType)?.blurb}
            </p>
          </div>

          {draft.rewardType === "discount" && (
            <div className="space-y-1.5">
              <Label>Discount type</Label>
              <Select
                value={draft.discountKind}
                onValueChange={(value) => patch({ discountKind: value as DiscountKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {draft.rewardType !== "other" && (
            <div className="grid grid-cols-2 gap-3">
              {money && (
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={draft.currency} onValueChange={(value) => patch({ currency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} ({currency.symbol}) — {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="campaign-amount">
                  {draft.rewardType === "discount" && draft.discountKind === "percentage"
                    ? "Percentage per referral"
                    : "Amount per referral"}
                </Label>
                <Input
                  id="campaign-amount"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(event) => patch({ amount: event.target.value })}
                />
              </div>
            </div>
          )}

          {draft.rewardType === "other" && (
            <div className="space-y-1.5">
              <Label htmlFor="campaign-description">Reward description</Label>
              <Textarea
                id="campaign-description"
                value={draft.description}
                onChange={(event) => patch({ description: event.target.value })}
                placeholder="Free course, extra access, certificate…"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Reward earned</Label>
            <Select value={draft.trigger} onValueChange={(value) => patch({ trigger: value as TriggerEvent })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((trigger) => (
                  <SelectItem key={trigger.value} value={trigger.value}>
                    {trigger.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TRIGGERS.find((t) => t.value === draft.trigger)?.blurb}
            </p>
          </div>

          {scope === "platform" && (
            <div className="space-y-2 rounded-xl border border-border/60 p-3">
              <Label>Who receives this offer</Label>
              <p className="text-xs text-muted-foreground">
                Only the audiences you tick are offered this reward and given a referral link.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {AUDIENCE_OPTIONS.map((option) => {
                  const checked = draft.audience.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/50 p-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          patch({
                            audience: value
                              ? [...draft.audience, option.value]
                              : draft.audience.filter((role) => role !== option.value),
                          })
                        }
                      />
                      <span>
                        <span className="font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.blurb}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="space-y-1.5 pt-1">
                <Label>Or assign it to one account only</Label>
                <Select
                  value={draft.targetUserId ?? "none"}
                  onValueChange={(value) => patch({ targetUserId: value === "none" ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No single account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No single account</SelectItem>
                    {(targets ?? []).map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.label}
                        {target.role ? ` — ${target.role}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(value) => patch({ status: value as CampaignStatus })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {CAMPAIGN_STATUSES.find((s) => s.value === draft.status)?.blurb}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
            <div>
              <div className="text-sm font-medium">Offer enabled</div>
              <p className="text-xs text-muted-foreground">
                {scope === "platform"
                  ? "Used for every referrer without their own campaign."
                  : "Used for referrals made from this workspace."}
              </p>
            </div>
            <Switch checked={draft.isActive} onCheckedChange={(value) => patch({ isActive: value })} />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)} disabled={saving}>
            {saving ? "Saving…" : "Save campaign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignDialog;
