import { useEffect, useState } from "react";
import { Coins, Loader2, ShieldOff } from "lucide-react";

import { credits as fmtCredits } from "@/lib/costs/categories";
import { fetchCreditActivity, saveCreditUsageEnabled } from "@/lib/costs/costs.functions";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; at: string; label: string; credits: number; balanceAfter: number };
type State = { balance: number; rows: Row[]; usageEnabled: boolean; canManage: boolean };

/**
 * The account's credit view: balance, what each action cost, and the payer's
 * switch. Deliberately free of cost prices, margins and pricing versions.
 */
const CreditsSection = ({ className = "" }: { className?: string }) => {
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetchCreditActivity()
      .then((result) => setState(result as State))
      .catch(() => setState(null));
  };

  useEffect(() => {
    load();
    // A deduction lands on the wallet; refresh as soon as it does.
    const channel = supabase
      .channel("credit-wallet-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "credit_wallets" }, load)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const toggle = async () => {
    if (!state) return;
    setSaving(true);
    try {
      const result = await saveCreditUsageEnabled({ data: { enabled: !state.usageEnabled } });
      setState(result as State);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`rounded-2xl border border-white/10 bg-white/5 p-5 text-white backdrop-blur ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/90">
          <Coins className="h-3.5 w-3.5" /> Credits
        </div>
        {state?.canManage ? (
          <button
            type="button"
            onClick={toggle}
            disabled={saving}
            className="min-h-[36px] rounded-xl border border-white/15 px-3 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-60"
          >
            {state.usageEnabled ? "Turn credit usage off" : "Turn credit usage on"}
          </button>
        ) : null}
      </div>

      {!state ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your credits…
        </p>
      ) : (
        <>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{fmtCredits(state.balance)}</div>

          {!state.usageEnabled ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Credit usage is currently disabled for this account.</span>
            </p>
          ) : null}

          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Credit activity</div>
          {state.rows.length === 0 ? (
            <p className="mt-2 text-sm text-white/60">No credit activity yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/10">
              {state.rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{row.label}</span>
                    <span className="text-xs text-white/45">{new Date(row.at).toLocaleDateString()}</span>
                  </span>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${row.credits < 0 ? "text-white/80" : "text-emerald-300"}`}
                  >
                    {row.credits < 0 ? "" : "+"}
                    {row.credits.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default CreditsSection;
