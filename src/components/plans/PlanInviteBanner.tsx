import { useState } from "react";
import { Sparkles, X } from "lucide-react";

import { Link } from "@/lib/router-compat";
import { usePlanGate } from "@/lib/plans/usePlanGate";

const DISMISS_KEY = "mathgpl.planInvite.dismissed";

/**
 * A calm invitation to pick a platform plan — never a wall. The homepage always
 * opens on the rotating building; this only suggests the pricing gateway.
 */
const PlanInviteBanner = () => {
  const { needsPlan } = usePlanGate();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  if (!needsPlan || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private browsing — dismissing for this render is enough */
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,30rem)] -translate-x-1/2 rounded-2xl border border-amber-300/40 bg-background/85 p-4 shadow-[0_18px_50px_rgba(4,8,25,0.45)] backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Choose your plan to unlock AI credits</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your workspace is open — a plan adds AI lesson building and credits.
          </p>
          <Link
            to="/plans/gateway"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-400 px-5 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
          >
            See the plans
          </Link>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="rounded-full border border-border p-1.5 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PlanInviteBanner;
