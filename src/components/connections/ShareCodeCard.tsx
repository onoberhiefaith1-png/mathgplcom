import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useShareCode } from "@/lib/connections/useConnections";

/**
 * The Share Code.
 *
 * It identifies this account so somebody can *request* a connection. It is not
 * a password and it can never sign anybody in — the MathGPL ID and password
 * remain the only way to log in.
 */
export const ShareCodeCard = () => {
  const { shareCode, loading, regenerate, regenerating } = useShareCode();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <KeyRound className="h-4 w-4 text-slate-500" /> My Share Code
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Give this code to a school, teacher, parent or student so they can send you a connection
        request. It is not a password and cannot be used to sign in.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 font-mono text-lg tracking-[0.2em] text-slate-900">
          {loading ? "………" : shareCode ?? "—"}
        </span>
        <Button type="button" variant="outline" onClick={copy} disabled={!shareCode} className="min-h-[44px]">
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void regenerate()}
          disabled={regenerating}
          className="min-h-[44px] text-slate-600"
        >
          {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          New code
        </Button>
      </div>
    </section>
  );
};

export default ShareCodeCard;
