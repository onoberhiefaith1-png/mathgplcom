import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CURRENCIES,
  REWARD_TYPES,
  TRIGGERS,
  type Campaign,
  type DiscountKind,
  type ReferralScope,
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
};

const draftFrom = (campaign?: Campaign | null): CampaignDraft => ({
  id: campaign?.id,
  name: campaign?.name ?? "Referral campaign",
  rewardType: campaign?.rewardType ?? "payment",
  currency: campaign?.rewardRule?.currency ?? "GBP",
  amount: campaign?.rewardRule?.amount != null ? String(campaign.rewardRule.amount) : "5",
  discountKind: campaign?.rewardRule?.discountKind ?? "percentage",
  description: campaign?.rewardRule?.description ?? "",
  trigger: campaign?.trigger ?? "subscription",
  isActive: campaign?.isActive ?? true,
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: Campaign | null;
  scope: ReferralScope;
  saving?: boolean;
  onSave: (draft: CampaignDraft) => void;
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

          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
            <div>
              <div className="text-sm font-medium">Campaign active</div>
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
