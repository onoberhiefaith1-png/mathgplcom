// Matrix quick-access palette — a docked right-hand panel in the lesson note.
//
// It behaves like the Emoji Library: it SHARES the editor width instead of
// covering the page. Dimension + compatible operation / special type → Enter →
// a REAL matrix object (bracketed grid with editable cells) is inserted at the
// cursor. It never replaces the full Matrix builder; it is the fast door for
// writing several matrices inside one lesson.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  QUICK_DIMS, QUICK_OPS, QUICK_SPECIALS,
  chooseDim, dimState, emptySelection, isReady,
  opState, previewSentence, quickMatrixSpec, specialState, toggleOp, toggleSpecial,
  type QuickSelection,
} from "@/lib/lessonnotes/matrixQuick";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Inserts a real matrix structure at the note's current cursor position. */
  onInsert: (spec: ReturnType<typeof quickMatrixSpec>) => void;
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

export function MatrixQuickPanel({ open, onClose, onInsert }: Props) {
  const [sel, setSel] = useState<QuickSelection>(emptySelection);

  useEffect(() => { if (!open) setSel(emptySelection()); }, [open]);

  if (!open) return null;

  const submit = () => {
    if (!isReady(sel)) return;
    onInsert(quickMatrixSpec(sel));
    // The panel stays open so several matrices can be placed in a row.
    setSel(emptySelection());
  };

  return (
    <aside
      aria-label="Matrix quick access"
      className="shrink-0 border-l border-border bg-background flex flex-col min-h-0 h-full self-stretch overscroll-contain"
      style={{ width: "clamp(280px, 30%, 420px)" }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
      }}
    >
      <div className="h-11 px-3 flex items-center justify-between border-b border-border">
        <div className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          Matrix
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close matrix panel"
          aria-label="Close matrix panel"
          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted/60 text-foreground/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
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
      </div>

      <div className="border-t border-border p-3 space-y-2">
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
      </div>
    </aside>
  );
}

export default MatrixQuickPanel;
