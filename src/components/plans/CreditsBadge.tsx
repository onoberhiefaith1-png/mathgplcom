import { useEffect, useState } from "react";
import { Coins } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { credits as fmtCredits } from "@/lib/costs/categories";
import { fetchCreditActivity } from "@/lib/costs/costs.functions";
import { supabase } from "@/integrations/supabase/client";
import CreditsSection from "./CreditsSection";

/**
 * The credit balance as header chrome: a compact balance, and the full existing
 * credit area one tap away. The dashboard never carries credits as a section.
 */
const CreditsBadge = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      fetchCreditActivity()
        .then((result) => setBalance(Number((result as { balance?: number }).balance ?? 0)))
        .catch(() => setBalance(null));
    };
    load();
    const channel = supabase
      .channel("credit-badge-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "credit_wallets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "credit_ledger" }, load)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Credits"
        aria-label="Credits"
        className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-ws-border/70 bg-ws-panel/60 px-3 text-xs font-semibold text-foreground transition hover:border-ws-gold/50"
      >
        <Coins className="h-3.5 w-3.5 shrink-0 text-ws-gold" />
        <span className="tabular-nums">{balance === null ? "Credits" : `${fmtCredits(balance)}`}</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[26rem] max-w-[95vw] overflow-y-auto border-ws-border bg-ws-canvas">
          <SheetHeader>
            <SheetTitle>Credits</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <CreditsSection />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default CreditsBadge;
