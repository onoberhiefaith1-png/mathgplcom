// Stage 5 — what the Copilot is building, item by item.

import { Check, CircleDot, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuildItem } from "@/lib/lessonnotes/copilot/procedure";

interface Props {
  queue: BuildItem[];
  onResume?: () => void;
  showResume?: boolean;
}

const Icon = ({ state }: { state: BuildItem["state"] }) =>
  state === "done" ? <Check className="h-3 w-3 mt-0.5 text-emerald-400" />
    : state === "running" ? <Loader2 className="h-3 w-3 mt-0.5 animate-spin text-amber-300" />
    : state === "failed" ? <X className="h-3 w-3 mt-0.5 text-red-400" />
    : <CircleDot className="h-3 w-3 mt-0.5 text-foreground/25" />;

const BuildProgress = ({ queue, onResume, showResume }: Props) => {
  if (!queue.length) return null;
  const done = queue.filter((q) => q.state === "done").length;
  return (
    <div className="rounded-xl border border-foreground/12 bg-foreground/[0.04] p-3 space-y-2">
      <p className="text-[9px] uppercase tracking-[0.28em] text-foreground/40">
        Lesson build · {done}/{queue.length}
      </p>
      <ul className="space-y-1">
        {queue.map((q) => (
          <li key={q.key} className="flex items-start gap-2 text-[11.5px]">
            <Icon state={q.state} />
            <span className={q.state === "pending" ? "text-foreground/40" : "text-foreground/80"}>
              {q.label}{q.detail ? ` — ${q.detail}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {showResume && onResume && (
        <Button
          size="sm"
          className="h-7 w-full text-[11px] bg-amber-400 text-amber-950 hover:bg-amber-300"
          onClick={onResume}
        >
          Carry on building
        </Button>
      )}
    </div>
  );
};

export default BuildProgress;
