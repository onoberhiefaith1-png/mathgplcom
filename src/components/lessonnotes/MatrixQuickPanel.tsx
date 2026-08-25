// Matrix quick-access palette — a compact popover in the lesson-note ribbon.
//
// Dimension + compatible operation / special type → Enter → inserted at the
// cursor. It never replaces the full Matrix builder; it is the fast door for
// writing several matrices inside one equation.

import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  QUICK_DIMS, QUICK_OPS, QUICK_SPECIALS,
  buildQuickMatrixLatex, chooseDim, dimState, emptySelection, isReady,
  opState, previewSentence, specialState, toggleOp, toggleSpecial,
  type QuickSelection,
} from "@/lib/lessonnotes/matrixQuick";

interface Props {
  /** Inserts a `mathInline` node carrying the built LaTeX. */
  insertMath: (latex: string) => void;
}

function Chip({
  label, selected, enabled, reason, onClick,
}: {
  label: string;
  selected: boolean;
  enabled: boolean;
  reason?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      title={enabled ? label : reason ?? "Not compatible"}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] leading-5 transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : enabled
            ? "border-border bg-background text-foreground hover:bg-muted"
            : "cursor-not-allowed border-border/60 bg-muted/50 text-muted-foreground/60",
      )}
    >
      {label}
    </button>
  );
}

const Band = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-1.5">
    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
    <div className="flex flex-wrap gap-1">{children}</div>
  </section>
);

export function MatrixQuickPanel({ insertMath }: Props) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<QuickSelection>(emptySelection);

  useEffect(() => { if (!open) setSel(emptySelection()); }, [open]);

  const submit = () => {
    if (!isReady(sel)) return;
    insertMath(buildQuickMatrixLatex(sel));
    setSel(emptySelection());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Matrix — quick access (dimension + operation → Enter)"
          aria-pressed={open}
          className={cn(
            "inline-flex items-center gap-1 rounded p-1.5 text-xs hover:bg-foreground/10",
            open && "bg-foreground/10",
          )}
        >
          <Grid3X3 className="h-4 w-4" /> Matrix
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[300px] space-y-3 p-3"
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
        }}
      >
        <Band title="Matrix">
          {QUICK_DIMS.map((d) => {
            const st = dimState(sel, d);
            const selected = !!sel.dim && sel.dim.rows === d.rows && sel.dim.cols === d.cols;
            return (
              <Chip
                key={`${d.rows}x${d.cols}`}
                label={`${d.rows}×${d.cols}`}
                selected={selected}
                enabled={st.enabled}
                reason={st.reason}
                onClick={() => setSel((s) => chooseDim(s, d))}
              />
            );
          })}
        </Band>

        <Band title="Matrix operations">
          {QUICK_OPS.map((o) => {
            const st = opState(sel, o.id);
            return (
              <Chip
                key={o.id}
                label={o.label}
                selected={sel.ops.includes(o.id)}
                enabled={st.enabled}
                reason={st.reason}
                onClick={() => setSel((s) => toggleOp(s, o.id))}
              />
            );
          })}
        </Band>

        <Band title="Special matrices">
          {QUICK_SPECIALS.map((sp) => {
            const st = specialState(sel, sp.id);
            return (
              <Chip
                key={sp.id}
                label={sp.label}
                selected={sel.special === sp.id}
                enabled={st.enabled}
                reason={st.reason}
                onClick={() => setSel((s) => toggleSpecial(s, sp.id))}
              />
            );
          })}
        </Band>

        <p className="rounded border border-border bg-muted/40 px-2 py-1 text-[11px] text-foreground">
          {previewSentence(sel)}
        </p>

        <button
          type="button"
          onClick={submit}
          disabled={!isReady(sel)}
          className={cn(
            "w-full rounded px-2 py-1.5 text-xs font-medium transition-colors",
            isReady(sel)
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          Enter
        </button>
      </PopoverContent>
    </Popover>
  );
}

export default MatrixQuickPanel;
