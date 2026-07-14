// Modal dialog used by every matrix asset. Gathers dimensions + bracket
// (and optionally a divider column) before inserting into the editor.

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type MatrixDialogKind = "matrix" | "matrixColVec" | "matrixRowVec" | "matrixIdentity" | "matrixAugmented";

export interface MatrixDialogResult {
  rows: number;
  cols: number;
  br: "(" | "[" | "{" | "|";
  divider?: number;
  template?: "identity";
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

export function MatrixCreateDialog({ kind, onCancel, onConfirm }: Props) {
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [br, setBr] = useState<MatrixDialogResult["br"]>("(");
  const [divider, setDivider] = useState(2);

  useEffect(() => {
    if (kind === "matrixColVec") { setRows(3); setCols(1); setBr("("); }
    else if (kind === "matrixRowVec") { setRows(1); setCols(3); setBr("("); }
    else if (kind === "matrixIdentity") { setRows(3); setCols(3); setBr("("); }
    else if (kind === "matrixAugmented") { setRows(2); setCols(3); setBr("("); setDivider(2); }
    else { setRows(2); setCols(2); setBr("("); }
  }, [kind]);

  if (!kind) return null;

  const title =
    kind === "matrixColVec" ? "Create column vector" :
    kind === "matrixRowVec" ? "Create row vector" :
    kind === "matrixIdentity" ? "Create identity matrix" :
    kind === "matrixAugmented" ? "Create augmented matrix" :
    "Create matrix";

  const showRows = kind !== "matrixRowVec";
  const showCols = kind !== "matrixColVec" && kind !== "matrixIdentity";
  const showBrackets = kind === "matrix";
  const showDivider = kind === "matrixAugmented";
  const lockedSquareForIdentity = kind === "matrixIdentity";

  const submit = () => {
    const r = Math.max(1, Math.min(20, rows | 0));
    let c = Math.max(1, Math.min(20, cols | 0));
    if (lockedSquareForIdentity) c = r;
    const out: MatrixDialogResult = { rows: r, cols: c, br };
    if (showDivider) out.divider = Math.max(1, Math.min(c - 1, divider | 0));
    if (kind === "matrixIdentity") out.template = "identity";
    onConfirm(out);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {showRows && (
            <div className="flex items-center justify-between gap-3">
              <Label>{lockedSquareForIdentity ? "Size (n × n)" : "Rows"}</Label>
              <input
                type="number" min={1} max={20} value={rows}
                onChange={(e) => setRows(Number(e.target.value) || 1)}
                className="w-20 rounded border bg-background px-2 py-1 text-sm"
              />
            </div>
          )}
          {showCols && (
            <div className="flex items-center justify-between gap-3">
              <Label>Columns</Label>
              <input
                type="number" min={1} max={20} value={cols}
                onChange={(e) => setCols(Number(e.target.value) || 1)}
                className="w-20 rounded border bg-background px-2 py-1 text-sm"
              />
            </div>
          )}
          {showBrackets && (
            <div className="flex items-center justify-between gap-3">
              <Label>Bracket</Label>
              <div className="flex gap-1">
                {BRACKETS.map((b) => (
                  <button key={b.v} type="button" onClick={() => setBr(b.v)}
                    className={`px-2 py-1 rounded border text-sm font-mono ${br === b.v ? "bg-primary/20 border-primary" : "border-foreground/20"}`}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showDivider && (
            <div className="flex items-center justify-between gap-3">
              <Label>Divider after column</Label>
              <input
                type="number" min={1} max={Math.max(1, cols - 1)} value={divider}
                onChange={(e) => setDivider(Number(e.target.value) || 1)}
                className="w-20 rounded border bg-background px-2 py-1 text-sm"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
