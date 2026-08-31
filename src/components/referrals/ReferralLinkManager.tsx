import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Link2, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { referralUrl } from "@/lib/links/publicUrl";
import {
  issueReferralLink,
  listReferralLinks,
  setReferralLinkActive,
} from "@/lib/referrals/referrals.functions";
import type { AdminCampaign, AdminReferralLink, ReferralTarget } from "@/lib/referrals/types";

type Props = { campaigns: AdminCampaign[]; targets: ReferralTarget[] };

/**
 * Referral links live here and nowhere else: only the administrator issues one,
 * and every link opens the public MathGPL address with the token behind it.
 */
const ReferralLinkManager = ({ campaigns, targets }: Props) => {
  const { toast } = useToast();
  const load = useServerFn(listReferralLinks);
  const issue = useServerFn(issueReferralLink);
  const toggle = useServerFn(setReferralLinkActive);

  const [rows, setRows] = useState<AdminReferralLink[]>([]);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [referrerId, setReferrerId] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setRows((await load()).rows);
    } catch (error) {
      toast({
        title: "Could not load referral links",
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

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(referralUrl(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const create = async () => {
    if (!campaignId || !referrerId) {
      toast({ title: "Choose an offer and the person it refers for", variant: "destructive" });
      return;
    }
    setWorking(true);
    try {
      const target = targets.find((row) => row.id === referrerId);
      await issue({
        data: {
          campaignId,
          referrerUserId: referrerId,
          orgId: target?.role === "school" ? null : null,
        },
      });
      setReferrerId("");
      await refresh();
      toast({ title: "Referral link issued" });
    } catch (error) {
      toast({ title: "Could not issue the link", description: (error as Error).message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const setActive = async (id: string, isActive: boolean) => {
    try {
      await toggle({ data: { id, isActive } });
      await refresh();
    } catch (error) {
      toast({ title: "Could not update the link", description: (error as Error).message, variant: "destructive" });
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-dash-border bg-dash-surface/5 p-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Referral links</h2>
      </div>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Only you issue referral links. Every link opens the public MathGPL site, and the token behind it records who
        referred the person. A referral never grants school membership — joining a school still needs a school code.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select
          value={campaignId}
          onChange={(event) => setCampaignId(event.target.value)}
          className="h-10 rounded-md border border-dash-border bg-background px-3 text-sm"
        >
          <option value="">Referral offer…</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
        <select
          value={referrerId}
          onChange={(event) => setReferrerId(event.target.value)}
          className="h-10 rounded-md border border-dash-border bg-background px-3 text-sm"
        >
          <option value="">Refers for…</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label}
              {target.role ? ` (${target.role})` : ""}
            </option>
          ))}
        </select>
        <Button onClick={() => void create()} disabled={working}>
          {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Issue link
        </Button>
      </div>

      {busy ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading referral links…
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No referral link has been issued yet.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-dash-border/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{row.referrerLabel}</span>
                {row.referrerKind && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-[0.14em]">
                    {row.referrerKind}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{row.campaignName}</span>
                <Badge variant={row.isActive ? "default" : "secondary"} className="ml-auto">
                  {row.isActive ? "Active" : "Disabled"}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input readOnly value={referralUrl(row.code)} className="min-w-[220px] flex-1 font-mono text-xs" />
                <Button size="sm" variant="secondary" onClick={() => void copy(row.code)}>
                  {copied === row.code ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} Copy
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void setActive(row.id, !row.isActive)}>
                  {row.isActive ? "Disable" : "Enable"}
                </Button>
                <span className="text-xs text-muted-foreground">{row.referred} referred</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ReferralLinkManager;
