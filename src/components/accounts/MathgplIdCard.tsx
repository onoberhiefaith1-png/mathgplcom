import { useState } from "react";
import { Check, Copy, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A MathGPL ID is how a person signs in, so it is always shown clearly and
 * can be copied in one tap.
 */
export const MathgplIdCard = ({
  mathgplId,
  typeLabel,
  note,
  tone = "dark",
}: {
  mathgplId: string;
  typeLabel?: string;
  note?: string;
  tone?: "dark" | "light";
}) => {
  const [copied, setCopied] = useState(false);
  const light = tone === "light";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mathgplId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div
      className={
        light
          ? "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          : "rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4"
      }
    >
      <p
        className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] ${
          light ? "text-slate-500" : "text-amber-200/80"
        }`}
      >
        <IdCard className="h-3.5 w-3.5" /> Your MathGPL ID
        {typeLabel ? <span className="normal-case tracking-normal">· {typeLabel}</span> : null}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className={`select-all font-mono text-xl font-semibold tracking-wider ${
            light ? "text-slate-900" : "text-white"
          }`}
        >
          {mathgplId}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copy}
          className={
            light
              ? "min-h-[36px] border-slate-300 text-slate-800"
              : "min-h-[36px] border-amber-300/40 bg-white/5 text-amber-100 hover:bg-amber-300/20"
          }
        >
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className={`mt-2 text-xs ${light ? "text-slate-500" : "text-white/60"}`}>
        {note ?? "Keep it safe — this ID never changes and it is how you log in."}
      </p>
    </div>
  );
};

export default MathgplIdCard;
