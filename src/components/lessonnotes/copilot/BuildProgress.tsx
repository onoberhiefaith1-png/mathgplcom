// Stage 5 — what the Copilot is building, item by item.

import { Check, CircleDot, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuildItem } from "@/lib/lessonnotes/copilot/procedure";

interface Props {
  queue: BuildItem[];
  onResume?: () => void;
  showResume?: boolean;
  /** Rebuild ONE item after its question changed, so its solution matches again. */
  onRebuildItem?: (key: string) => void;
  busy?: boolean;
}

const Icon = ({ state }: { state: BuildItem["state"] }) =>
  state === "done" ? <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-600" />
    : state === "running" ? <Loader2 className="h-3.5 w-3.5 mt-0.5 animate-spin text-amber-500" />
    : state === "failed" ? <X className="h-3.5 w-3.5 mt-0.5 text-destructive" />
    : <CircleDot className="h-3.5 w-3.5 mt-0.5 text-slate-400" />;

const BuildProgress = ({ queue, onResume, showResume, onRebuildItem, busy }: Props) => {
  if (!queue.length) return null;
  const done = queue.filter((q) => q.state === "done").length;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">
        Lesson build · {done}/{queue.length}
      </p>
      <ul className="space-y-1">
        {queue.map((q) => (
          <li key={q.key} className="flex items-start gap-2 text-xs">
            <Icon state={q.state} />
            {/* Full-contrast ink for every state — the icon carries progress. */}
            {/* The panel is a fixed light surface, so the ink is fixed dark —
                theme ink turned near-white here and the inventory looked blurred. */}
            <span className="font-medium text-slate-900">
              {q.label}{q.detail ? ` — ${q.detail}` : ""}
            </span>

            {q.solutionStale && onRebuildItem && (
              <Button
                size="sm" variant="ghost" disabled={busy}
                className="ml-auto h-5 gap-1 px-1.5 text-[10.5px] text-amber-300 hover:text-amber-200"
                onClick={() => onRebuildItem(q.key)}
                aria-label={`Rewrite the solution for ${q.label}`}
              >
                <RefreshCw className="h-2.5 w-2.5" /> solution
              </Button>
            )}
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
