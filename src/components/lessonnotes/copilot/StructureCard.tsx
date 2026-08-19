// Stage 2 of the fixed Copilot procedure — the Lesson Note Structure.
//
// The teacher controls the quantity by editing the numbers. The Copilot must
// never ask "how many examples do you want?".

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MAX_PER_SECTION, STRUCTURE_ROWS, rowLabel, type StructureCounts,
} from "@/lib/lessonnotes/copilot/procedure";

interface Props {
  counts: StructureCounts;
  onChange: (counts: StructureCounts) => void;
  onConfirm: () => void;
  locked?: boolean;
}

const StructureCard = ({ counts, onChange, onConfirm, locked }: Props) => {
  const step = (kind: string, delta: number) => {
    const next = Math.max(0, Math.min(MAX_PER_SECTION, (counts[kind] ?? 0) + delta));
    onChange({ ...counts, [kind]: next });
  };

  return (
    <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-3 space-y-2">
      <p className="text-[9px] uppercase tracking-[0.28em] text-amber-200/70">Lesson structure</p>

      <ul className="divide-y divide-foreground/10">
        {STRUCTURE_ROWS.map((kind) => (
          <li key={kind} className="flex items-center justify-between py-1.5">
            <span className="text-[12px] text-foreground/85">{rowLabel(kind)}</span>
            <span className="flex items-center gap-1">
              <Button
                size="icon" variant="ghost" disabled={locked}
                className="h-6 w-6 text-foreground/50 hover:text-foreground"
                onClick={() => step(kind, -1)}
                aria-label={`One fewer ${rowLabel(kind)}`}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <input
                value={counts[kind] ?? 0}
                inputMode="numeric"
                disabled={locked}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                  onChange({ ...counts, [kind]: Number.isFinite(n) ? Math.min(MAX_PER_SECTION, n) : 0 });
                }}
                className="w-9 rounded-md border border-foreground/15 bg-background/40 px-1 py-0.5 text-center text-[12px] text-foreground/90 outline-none focus:border-amber-300/60"
                aria-label={`Number of ${rowLabel(kind)} sections`}
              />
              <Button
                size="icon" variant="ghost" disabled={locked}
                className="h-6 w-6 text-foreground/50 hover:text-foreground"
                onClick={() => step(kind, 1)}
                aria-label={`One more ${rowLabel(kind)}`}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </span>
          </li>
        ))}
      </ul>

      {!locked && (
        <Button
          size="sm"
          className="h-7 w-full text-[11px] bg-amber-400 text-amber-950 hover:bg-amber-300"
          onClick={onConfirm}
        >
          Use this structure
        </Button>
      )}
    </div>
  );
};

export default StructureCard;
