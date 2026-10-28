import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { TreeModel, TreeNode } from "./types";
import { DEFAULT_BRANCH, newNodeId } from "./types";
import { cloneTree, findNode, findParent, maxDepth } from "./layout";

interface Props {
  open: boolean;
  onClose: () => void;
  model: TreeModel;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (m: TreeModel) => void;
  onDeleteDiagram?: () => void;
}

const COLORS = ["#111827", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6"];

function makeChild(label: string): TreeNode {
  return {
    id: newNodeId(),
    label,
    prob: "",
    expr: "",
    color: "#111827",
    size: 18,
    revealed: true,
    branch: DEFAULT_BRANCH(),
    children: [],
  };
}

function forEachAtDepth(root: TreeNode, targetDepth: number, cb: (n: TreeNode) => void, d = 0) {
  if (d === targetDepth) cb(root);
  if (d < targetDepth) root.children.forEach((c) => forEachAtDepth(c, targetDepth, cb, d + 1));
}

function pruneToDepth(n: TreeNode, targetDepth: number, d = 0) {
  if (d >= targetDepth) n.children = [];
  else n.children.forEach((c) => pruneToDepth(c, targetDepth, d + 1));
}

function padToFan(n: TreeNode, fan: number, targetDepth: number, d = 0) {
  if (d < targetDepth) {
    while (n.children.length < fan) n.children.push(makeChild(`n${n.children.length + 1}`));
    n.children.forEach((c) => padToFan(c, fan, targetDepth, d + 1));
  }
}

export function TreeEnginePanel({ open, onClose, model, selectedId, onSelect, onChange, onDeleteDiagram }: Props) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const root = document.documentElement;
    const prev = root.style.getPropertyValue("--geometry-panel-offset");
    root.style.setProperty("--geometry-panel-offset", expanded ? "clamp(320px, 33vw, 440px)" : "44px");
    return () => {
      if (prev) root.style.setProperty("--geometry-panel-offset", prev);
      else root.style.removeProperty("--geometry-panel-offset");
    };
  }, [open, expanded]);

  if (!open || typeof document === "undefined") return null;
  const guard = (e: SyntheticEvent) => e.stopPropagation();

  const selected = selectedId ? findNode(model.root, selectedId) : null;
  const parent = selectedId ? findParent(model.root, selectedId) : null;
  const currentLevels = maxDepth(model.root);
  const currentFan = model.root.children.length || 2;

  const patchNode = (id: string, patch: Partial<TreeNode>) => {
    const next = cloneTree(model.root);
    const n = findNode(next, id);
    if (!n) return;
    Object.assign(n, patch);
    onChange({ ...model, root: next });
  };
  const patchBranch = (id: string, patch: Partial<TreeNode["branch"]>) => {
    const next = cloneTree(model.root);
    const n = findNode(next, id);
    if (!n) return;
    n.branch = { ...n.branch, ...patch };
    onChange({ ...model, root: next });
  };

  const setLevels = (lv: number) => {
    const next = cloneTree(model.root);
    // Ensure at least a fan of 2 exists at every level up to lv
    const fan = Math.max(2, currentFan);
    for (let d = 0; d < lv; d++) forEachAtDepth(next, d, (n) => { if (n.children.length === 0) for (let i=0;i<fan;i++) n.children.push(makeChild(`n${i+1}`)); });
    pruneToDepth(next, lv);
    onChange({ ...model, root: next });
  };

  const setFan = (fn: number) => {
    const next = cloneTree(model.root);
    padToFan(next, fn, currentLevels);
    // Trim extras
    const trim = (n: TreeNode, d: number) => {
      if (d < currentLevels && n.children.length > fn) n.children.length = fn;
      n.children.forEach((c) => trim(c, d + 1));
    };
    trim(next, 0);
    onChange({ ...model, root: next });
  };

  const addChildTo = (id: string) => {
    const next = cloneTree(model.root);
    const n = findNode(next, id);
    if (!n) return;
    n.children.push(makeChild(`n${n.children.length + 1}`));
    onChange({ ...model, root: next });
  };
  const deleteNode = (id: string) => {
    if (id === model.root.id) return;
    const next = cloneTree(model.root);
    const p = findParent(next, id);
    if (!p) return;
    p.children = p.children.filter((c) => c.id !== id);
    onSelect(null);
    onChange({ ...model, root: next });
  };

  const shellClass = expanded
    ? "fixed inset-y-0 right-0 z-50 w-[clamp(320px,33vw,440px)] shadow-2xl border-l border-border overflow-hidden flex flex-col"
    : "fixed inset-y-0 right-0 z-50 w-11 shadow-2xl border-l border-border overflow-hidden flex flex-col items-center";
  const panelStyle = { background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

  const foldButton = (
    <button type="button" onClick={() => setExpanded((v) => !v)}
      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted/60"
      title={expanded ? "Fold" : "Show"}>
      {expanded ? "›" : "⚙"}
    </button>
  );

  if (!expanded) {
    return createPortal(
      <aside className={shellClass} style={panelStyle}
        onMouseDown={guard} onPointerDown={guard} onClick={guard}>
        <div className="pt-3">{foldButton}</div>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          Tree
        </div>
      </aside>,
      document.body,
    );
  }

  return createPortal(
    <div className={shellClass} style={panelStyle}
      onMouseDown={guard} onPointerDown={guard} onClick={guard}>
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          {foldButton}
          <div className="text-sm font-semibold">Tree diagram</div>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Structure</div>
          <div className="flex items-center gap-2">
            <span className="w-24">Levels</span>
            <button className="px-2 py-0.5 border rounded" onClick={() => setLevels(Math.max(1, currentLevels - 1))}>−</button>
            <span className="w-6 text-center">{currentLevels}</span>
            <button className="px-2 py-0.5 border rounded" onClick={() => setLevels(Math.min(6, currentLevels + 1))}>+</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24">Branches / node</span>
            <button className="px-2 py-0.5 border rounded" onClick={() => setFan(Math.max(1, currentFan - 1))}>−</button>
            <span className="w-6 text-center">{currentFan}</span>
            <button className="px-2 py-0.5 border rounded" onClick={() => setFan(Math.min(6, currentFan + 1))}>+</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24">Direction</span>
            <select
              value={model.direction}
              onChange={(e) => onChange({ ...model, direction: e.target.value as TreeModel["direction"] })}
              className="border rounded px-1 py-0.5 bg-background"
            >
              <option value="TB">Top → Bottom</option>
              <option value="LR">Left → Right</option>
            </select>
          </div>
        </section>

        {selected ? (
          <>
            <section className="space-y-2 border-t pt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Node <span className="text-foreground/60">({selected.id.slice(0, 5)})</span>
              </div>
              <label className="flex items-center gap-2">
                <span className="w-24">Label</span>
                <input value={selected.label} onChange={(e) => patchNode(selected.id, { label: e.target.value })}
                  className="flex-1 border rounded px-2 py-1 bg-background"/>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Probability</span>
                <input value={selected.prob} onChange={(e) => patchNode(selected.id, { prob: e.target.value })}
                  placeholder="e.g. 1/2"
                  className="flex-1 border rounded px-2 py-1 bg-background"/>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Expression</span>
                <input value={selected.expr} onChange={(e) => patchNode(selected.id, { expr: e.target.value })}
                  placeholder="e.g. P(A∩B)"
                  className="flex-1 border rounded px-2 py-1 bg-background"/>
              </label>
              <div className="flex items-center gap-2">
                <span className="w-24">Colour</span>
                <div className="flex gap-1">
                  {COLORS.map((c) => (
                    <button key={c}
                      onClick={() => patchNode(selected.id, { color: c })}
                      className="w-5 h-5 rounded-full border"
                      style={{ background: c, outline: selected.color === c ? "2px solid #3b82f6" : "none" }}
                    />
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2">
                <span className="w-24">Size</span>
                <input type="range" min={10} max={40} value={selected.size}
                  onChange={(e) => patchNode(selected.id, { size: Number(e.target.value) })}
                  className="flex-1"/>
                <span className="w-8 text-right">{selected.size}</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24">Revealed</span>
                <input type="checkbox" checked={selected.revealed}
                  onChange={(e) => patchNode(selected.id, { revealed: e.target.checked })}/>
                <span className="text-muted-foreground">Hide/show subtree for reveal</span>
              </label>
            </section>

            {parent && (
              <section className="space-y-2 border-t pt-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Incoming branch</div>
                <label className="flex items-center gap-2">
                  <span className="w-24">Label</span>
                  <input value={selected.branch.label} onChange={(e) => patchBranch(selected.id, { label: e.target.value })}
                    className="flex-1 border rounded px-2 py-1 bg-background"/>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-24">Probability</span>
                  <input value={selected.branch.prob} onChange={(e) => patchBranch(selected.id, { prob: e.target.value })}
                    className="flex-1 border rounded px-2 py-1 bg-background"/>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-24">Thickness</span>
                  <input type="range" min={1} max={5} step={0.5} value={selected.branch.thickness}
                    onChange={(e) => patchBranch(selected.id, { thickness: Number(e.target.value) })}
                    className="flex-1"/>
                  <span className="w-8 text-right">{selected.branch.thickness}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-24">Arrow</span>
                  <input type="checkbox" checked={selected.branch.arrow}
                    onChange={(e) => patchBranch(selected.id, { arrow: e.target.checked })}/>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-24">Dash</span>
                  <select value={selected.branch.dash ?? "solid"}
                    onChange={(e) => patchBranch(selected.id, { dash: e.target.value as "solid" | "dashed" })}
                    className="border rounded px-1 py-0.5 bg-background">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                  </select>
                </label>
              </section>
            )}

            <section className="flex flex-wrap gap-2 border-t pt-3">
              <button className="px-2 py-1 border rounded bg-primary text-primary-foreground text-xs"
                onClick={() => addChildTo(selected.id)}>+ Add branch</button>
              {selected.id !== model.root.id && (
                <button className="px-2 py-1 border rounded text-xs"
                  onClick={() => deleteNode(selected.id)}>Delete branch</button>
              )}
            </section>
          </>
        ) : (
          <div className="text-muted-foreground border-t pt-3">Click a node to edit it.</div>
        )}

        {onDeleteDiagram && (
          <div className="border-t pt-3">
            <button className="text-xs text-destructive hover:underline" onClick={onDeleteDiagram}>
              Delete diagram
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
