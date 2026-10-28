// Matrix Builder — the single guided flow for creating a matrix expression:
//
//   Dimension → Bracket → Functions → Create
//
// It never calculates anything. It only collects what the teacher wants so
// the inserted object carries the right structure and notation.

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  MATRIX_FUNCTIONS, composeNotation, previewNotation, type MatrixFnId,
} from "@/lib/lessonnotes/matrixFunctions";

export type MatrixDialogKind = "matrix" | "matrixColVec" | "matrixRowVec" | "matrixIdentity" | "matrixAugmented";

export interface MatrixDialogResult {
  rows: number;
  cols: number;
  br: "(" | "[" | "{" | "|";
  divider?: number;
  template?: "identity";
  /** Selected notation functions, in selection order. */
  fns?: MatrixFnId[];
  /** True when Matrix Power was selected — adds an editable exponent slot. */
  power?: boolean;
}

interface Props {
  kind: MatrixDialogKind | null;
  onCancel: () => void;
  onConfirm: (r: MatrixDialogResult) => void;
}

const BRACKETS: Array<{ v: MatrixDialogResult["br"]; label: string }> = [
  { v: "(", label: "( )" },
  { v: "[", label: "[ ]" },
  { v: "{", label: "{ }" },
  { v: "|", label: "| |" },
];

const QUICK: Array<[number, number]> = [[2, 2], [2, 3], [3, 3], [3, 4]];

export function MatrixCreateDialog({ kind, onCancel, onConfirm }: Props) {
  // Empty strings so the inputs can show real placeholders until the
  // teacher types. Placeholder text NEVER enters the document.
  const [rowsText, setRowsText] = useState("");
  const [colsText, setColsText] = useState("");
  const [br, setBr] = useState<MatrixDialogResult["br"]>("(");
  const [divider, setDivider] = useState(2);
  const [fns, setFns] = useState<MatrixFnId[]>([]);

  useEffect(() => {
    setFns([]);
    if (kind === "matrixColVec") { setRowsText("3"); setColsText("1"); setBr("("); }
    else if (kind === "matrixRowVec") { setRowsText("1"); setColsText("3"); setBr("("); }
    else if (kind === "matrixIdentity") { setRowsText("3"); setColsText("3"); setBr("("); }
    else if (kind === "matrixAugmented") { setRowsText("2"); setColsText("3"); setBr("("); setDivider(2); }
    else { setRowsText(""); setColsText(""); setBr("("); }
  }, [kind]);

  const rows = Math.max(0, Math.min(20, parseInt(rowsText, 10) || 0));
  const cols = Math.max(0, Math.min(20, parseInt(colsText, 10) || 0));

  const isFullBuilder = kind === "matrix";
  const showRows = kind !== "matrixRowVec";
  const showCols = kind !== "matrixColVec" && kind !== "matrixIdentity";
  const showDivider = kind === "matrixAugmented";
  const lockedSquareForIdentity = kind === "matrixIdentity";

  const preview = useMemo(() => previewNotation(fns, br), [fns, br]);
  const ready = rows >= 1 && (lockedSquareForIdentity || cols >= 1);

  if (!kind) return null;

  const title =
    kind === "matrixColVec" ? "Create column vector" :
    kind === "matrixRowVec" ? "Create row vector" :
    kind === "matrixIdentity" ? "Create identity matrix" :
    kind === "matrixAugmented" ? "Create augmented matrix" :
    "Matrix builder";

  const toggleFn = (id: MatrixFnId) =>
    setFns((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const submit = () => {
    const r = Math.max(1, Math.min(20, rows || 2));
    let c = Math.max(1, Math.min(20, cols || 2));
    if (lockedSquareForIdentity) c = r;
    const out: MatrixDialogResult = { rows: r, cols: c, br };
    if (showDivider) out.divider = Math.max(1, Math.min(c - 1, divider | 0));
    if (kind === "matrixIdentity") out.template = "identity";
    if (isFullBuilder && fns.length) {
      out.fns = fns;
      if (fns.includes("power")) out.power = true;
    }
    onConfirm(out);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className={isFullBuilder ? "max-w-md" : "max-w-sm"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* ── Step 1: dimension ── */}
          <section className="space-y-2">
            <StepLabel n={1} text="Dimension" />
            <div className="flex items-center gap-3">
              {showRows && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">{lockedSquareForIdentity ? "Size n" : "Rows"}</Label>
                  <input
                    type="number" min={1} max={20} value={rowsText} placeholder="rows"
                    onChange={(e) => setRowsText(e.target.value)}
                    className="w-20 rounded border bg-background px-2 py-1 text-sm"
                  />
                </div>
              )}
              {showCols && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Columns</Label>
                  <input
                    type="number" min={1} max={20} value={colsText} placeholder="columns"
                    onChange={(e) => setColsText(e.target.value)}
                    className="w-20 rounded border bg-background px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>
            {isFullBuilder && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {QUICK.map(([r, c]) => (
                  <button
                    key={`${r}x${c}`} type="button"
                    onClick={() => { setRowsText(String(r)); setColsText(String(c)); }}
                    className={`px-2 py-0.5 rounded border text-xs ${rows === r && cols === c ? "bg-primary/20 border-primary" : "border-foreground/20 hover:bg-foreground/5"}`}
                  >
                    {r} × {c}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ── Step 2: bracket ── */}
          <section className="space-y-2">
            <StepLabel n={2} text="Bracket" />
            <div className="flex gap-1">
              {BRACKETS.map((b) => (
                <button key={b.v} type="button" onClick={() => setBr(b.v)}
                  className={`px-3 py-1 rounded border text-sm font-mono ${br === b.v ? "bg-primary/20 border-primary" : "border-foreground/20 hover:bg-foreground/5"}`}>
                  {b.label}
                </button>
              ))}
            </div>
          </section>

          {showDivider && (
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs">Divider after column</Label>
              <input
                type="number" min={1} max={Math.max(1, cols - 1)} value={divider}
                onChange={(e) => setDivider(Number(e.target.value) || 1)}
                className="w-20 rounded border bg-background px-2 py-1 text-sm"
              />
            </div>
          )}

          {/* ── Step 3: functions ── */}
          {isFullBuilder && (
            <section className="space-y-2">
              <StepLabel n={3} text="Functions (notation only — nothing is calculated)" />
              <div className="flex flex-wrap gap-1">
                {MATRIX_FUNCTIONS.map((f) => {
                  const on = fns.includes(f.id);
                  return (
                    <button
                      key={f.id} type="button" onClick={() => toggleFn(f.id)} title={f.hint}
                      className={`px-2 py-1 rounded border text-xs ${on ? "bg-primary/20 border-primary text-foreground" : "border-foreground/20 hover:bg-foreground/5"}`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
              {fns.includes("power") && (
                <p className="text-[11px] text-muted-foreground">
                  Matrix power adds an empty exponent — type n, 5, k… into it after inserting.
                </p>
              )}
            </section>
          )}

          {/* ── Preview ── */}
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Preview</div>
            <div className="text-sm font-mono">
              {ready
                ? `${preview}   ${rows} × ${lockedSquareForIdentity ? rows : cols}`
                : "Enter rows and columns"}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} disabled={!ready}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid place-items-center h-4 w-4 rounded-full bg-primary/15 text-[10px] font-semibold">{n}</span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{text}</span>
    </div>
  );
}

export { composeNotation };
