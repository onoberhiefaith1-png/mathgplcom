// Floating toolbar that appears above the currently selected matrix. It is
// the ONLY place structural matrix edits live — the asset library inserts,
// the toolbar edits. Software never solves math; teachers drive every op.

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  findMatrix, addRow, deleteLastRow, duplicateLastRow, swapRows,
  addColumn, deleteLastColumn, swapColumns,
  setBracket, moveDivider, removeDivider, toggleLock,
  applyTemplate, applyRowOperation,
  type MatrixAttrs, type Bracket, type MatrixTemplate,
} from "@/lib/lessonnotes/matrixOps";
import { toast } from "@/hooks/use-toast";

interface Props { editor: Editor | null }

const BRACKETS: Array<{ v: Bracket; label: string }> = [
  { v: "(", label: "( )" }, { v: "[", label: "[ ]" },
  { v: "{", label: "{ }" }, { v: "|", label: "| |" },
];

const TEMPLATES: Array<{ v: MatrixTemplate; label: string }> = [
  { v: "identity", label: "Identity" },
  { v: "zero", label: "Zero" },
  { v: "diagonal", label: "Diagonal" },
  { v: "scalar", label: "Scalar" },
  { v: "upperTriangular", label: "Upper △" },
  { v: "lowerTriangular", label: "Lower △" },
  { v: "symmetric", label: "Symmetric" },
  { v: "augmented", label: "Augmented" },
];

export function MatrixToolbar({ editor }: Props) {
  const [state, setState] = useState<{ rect: DOMRect; attrs: MatrixAttrs; pos: number } | null>(null);
  const [rowOpOpen, setRowOpOpen] = useState(false);
  const [rowOp, setRowOp] = useState("R2 = R2 - R1");
  const [swapRowsOpen, setSwapRowsOpen] = useState(false);
  const [swapColsOpen, setSwapColsOpen] = useState(false);
  const [i, setI] = useState(1);
  const [j, setJ] = useState(2);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const m = findMatrix(editor);
      if (!m) { setState(null); return; }
      const dom = editor.view.nodeDOM(m.pos) as HTMLElement | null;
      if (!dom || !("getBoundingClientRect" in dom)) { setState(null); return; }
      setState({ rect: dom.getBoundingClientRect(), attrs: m.attrs, pos: m.pos });
    };
    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editor]);

  if (!editor || !state) return null;
  const { rect, attrs } = state;
  const top = Math.max(8, rect.top + window.scrollY - 46);
  const left = rect.left + window.scrollX;
  const locked = !!attrs.locked;

  const run = (fn: () => void) => { fn(); };
  const onRowOp = () => {
    const res = applyRowOperation(editor, rowOp);
    if (!res.ok) toast({ title: "Row operation", description: res.error ?? "Invalid" });
    else setRowOpOpen(false);
  };

  return (
    <div
      style={{ position: "absolute", top, left, zIndex: 40 }}
      onMouseDown={(e) => e.preventDefault()}
      className="matrix-toolbar bg-background border rounded-md shadow-lg px-1.5 py-1 flex items-center gap-1 text-xs"
    >
      <span className="px-1.5 text-foreground/60">{attrs.rows}×{attrs.cols}</span>
      <Sep />
      <Group label="Row">
        <Btn onClick={() => run(() => addRow(editor, "above"))} disabled={locked}>+↑</Btn>
        <Btn onClick={() => run(() => addRow(editor, "below"))} disabled={locked}>+↓</Btn>
        <Btn onClick={() => run(() => duplicateLastRow(editor))} disabled={locked}>×2</Btn>
        <Btn onClick={() => run(() => deleteLastRow(editor))} disabled={locked || attrs.rows <= 1}>−</Btn>
        <Btn onClick={() => setSwapRowsOpen((v) => !v)} disabled={locked || attrs.rows < 2}>swap</Btn>
      </Group>
      <Sep />
      <Group label="Col">
        <Btn onClick={() => run(() => addColumn(editor, "left"))} disabled={locked}>+←</Btn>
        <Btn onClick={() => run(() => addColumn(editor, "right"))} disabled={locked}>+→</Btn>
        <Btn onClick={() => run(() => deleteLastColumn(editor))} disabled={locked || attrs.cols <= 1}>−</Btn>
        <Btn onClick={() => setSwapColsOpen((v) => !v)} disabled={locked || attrs.cols < 2}>swap</Btn>
      </Group>
      <Sep />
      <Group label="Brackets">
        {BRACKETS.map((b) => (
          <Btn key={b.v} onClick={() => setBracket(editor, b.v)} active={attrs.br === b.v}>{b.label}</Btn>
        ))}
      </Group>
      <Sep />
      {typeof attrs.divider === "number" ? (
        <Group label="Divider">
          <Btn onClick={() => moveDivider(editor, -1)}>←</Btn>
          <span className="px-1">{attrs.divider}</span>
          <Btn onClick={() => moveDivider(editor, +1)}>→</Btn>
          <Btn onClick={() => removeDivider(editor)}>×</Btn>
        </Group>
      ) : (
        <Btn onClick={() => applyTemplate(editor, "augmented")} disabled={locked || attrs.cols < 2}>+divider</Btn>
      )}
      <Sep />
      <select
        onChange={(e) => { const v = e.target.value as MatrixTemplate; if (v) applyTemplate(editor, v); e.currentTarget.value = ""; }}
        disabled={locked}
        className="text-xs bg-transparent border rounded px-1 py-0.5"
        defaultValue=""
      >
        <option value="" disabled>Template…</option>
        {TEMPLATES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
      </select>
      <Sep />
      <Btn onClick={() => setRowOpOpen((v) => !v)} disabled={locked}>Row op…</Btn>
      <Btn onClick={() => toggleLock(editor)} active={locked} title="Lock structure">{locked ? "🔒" : "🔓"}</Btn>

      {swapRowsOpen && (
        <Popover onClose={() => setSwapRowsOpen(false)}>
          <span>Swap rows</span>
          <NumInput value={i} onChange={setI} max={attrs.rows} />
          <span>↔</span>
          <NumInput value={j} onChange={setJ} max={attrs.rows} />
          <button className="px-2 py-0.5 rounded border" onClick={() => { swapRows(editor, i - 1, j - 1); setSwapRowsOpen(false); }}>Go</button>
        </Popover>
      )}
      {swapColsOpen && (
        <Popover onClose={() => setSwapColsOpen(false)}>
          <span>Swap cols</span>
          <NumInput value={i} onChange={setI} max={attrs.cols} />
          <span>↔</span>
          <NumInput value={j} onChange={setJ} max={attrs.cols} />
          <button className="px-2 py-0.5 rounded border" onClick={() => { swapColumns(editor, i - 1, j - 1); setSwapColsOpen(false); }}>Go</button>
        </Popover>
      )}
      {rowOpOpen && (
        <Popover onClose={() => setRowOpOpen(false)}>
          <input
            value={rowOp} onChange={(e) => setRowOp(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onRowOp(); }}
            className="w-56 px-1.5 py-0.5 rounded border bg-background"
            placeholder="R2 = R2 - 3R1"
          />
          <button className="px-2 py-0.5 rounded border" onClick={onRowOp}>Apply</button>
        </Popover>
      )}
    </div>
  );
}

function Btn({ children, onClick, active, disabled, title }: {
  children: React.ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; title?: string;
}) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled} title={title}
      className={`px-1.5 py-0.5 rounded border text-xs ${active ? "bg-primary/20 border-primary" : "border-foreground/15 hover:bg-foreground/5"} disabled:opacity-40 disabled:cursor-not-allowed`}>
      {children}
    </button>
  );
}
function Sep() { return <span className="w-px h-4 bg-foreground/15 mx-0.5" />; }
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-0.5" title={label}>
      <span className="text-[10px] uppercase tracking-wide text-foreground/40 mr-0.5">{label}</span>
      {children}
    </span>
  );
}
function NumInput({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  return (
    <input type="number" min={1} max={max} value={value} onChange={(e) => onChange(Number(e.target.value) || 1)}
      className="w-12 px-1 py-0.5 rounded border bg-background text-xs" />
  );
}
function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".matrix-toolbar")) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return (
    <div className="absolute left-0 top-full mt-1 bg-background border rounded shadow-sm px-2 py-1 flex items-center gap-1">
      {children}
    </div>
  );
}
