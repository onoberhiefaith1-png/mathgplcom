import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = [
  ["B", "Brackets", "text-sky-300"],
  ["I", "Indices", "text-violet-300"],
  ["D", "Division", "text-emerald-300"],
  ["M", "Multiplication", "text-amber-300"],
  ["A", "Addition", "text-rose-300"],
  ["S", "Subtraction", "text-fuchsia-300"],
] as const;

export const HowToPlayPanel = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-card/60 backdrop-blur overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-card/80 transition-colors"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-amber-300" />
          <span className="text-[11px] uppercase tracking-[0.25em] font-bold">How to Play</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-primary/20 pt-3 text-xs text-foreground/85">
          <p>
            Solve the equation step by step using <span className="text-amber-300 font-bold">BIDMAS</span> order.
            Each row should simplify the previous one until you reach the final answer.
          </p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Tap a tile to place the cursor.</li>
            <li>Use the keypad to type digits and operators.</li>
            <li>Press <span className="text-emerald-300 font-bold">ENTER</span> to submit a row.</li>
            <li>Each correct simplification rewards coins, diamonds, hearts and crowns.</li>
            <li>Reach the final value to solve the question.</li>
          </ol>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-1.5">BIDMAS Key</div>
            <ul className="grid grid-cols-2 gap-1">
              {KEY.map(([l, n, c]) => (
                <li key={l} className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md border border-primary/30 font-black ${c}`}>{l}</span>
                  <span className="text-foreground/80 text-[11px]">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
