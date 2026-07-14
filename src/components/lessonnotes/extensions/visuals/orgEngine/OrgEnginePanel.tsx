import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { OrgDirection, OrgModel, OrgShape } from "./types";
import { DEFAULT_EDGE, newOrgId } from "./types";
import { cloneOrg, findOrg, findOrgParent } from "./layout";

interface Props {
  open: boolean;
  onClose: () => void;
  model: OrgModel;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (m: OrgModel) => void;
  onDeleteDiagram?: () => void;
}

const SHAPES: { v: OrgShape; label: string }[] = [
  { v: "rect", label: "Rect" },
  { v: "roundedRect", label: "Rounded" },
  { v: "circle", label: "Circle" },
  { v: "diamond", label: "Diamond" },
  { v: "hexagon", label: "Hexagon" },
];

export function OrgEnginePanel({ open, onClose, model, selectedId, onSelect, onChange, onDeleteDiagram }: Props) {
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

  const sel = selectedId ? findOrg(model.root, selectedId) : null;

  const patch = (id: string, patch: Partial<typeof sel>) => {
    const next = cloneOrg(model.root);
    const n = findOrg(next, id);
    if (!n) return;
    Object.assign(n, patch);
    onChange({ ...model, root: next });
  };
  const patchEdge = (id: string, p: Partial<typeof sel extends null ? never : NonNullable<typeof sel>["edge"]>) => {
    const next = cloneOrg(model.root);
    const n = findOrg(next, id);
    if (!n) return;
    n.edge = { ...n.edge, ...p };
    onChange({ ...model, root: next });
  };
  const addChild = () => {
    if (!sel) return;
    const next = cloneOrg(model.root);
    const n = findOrg(next, sel.id);
    if (!n) return;
    n.children.push({
      id: newOrgId(),
      text: `Node ${n.children.length + 1}`,
      color: sel.color, border: sel.border, shape: sel.shape,
      collapsed: false, edge: DEFAULT_EDGE(), children: [],
    });
    onChange({ ...model, root: next });
  };
  const duplicate = () => {
    if (!sel) return;
    const p = findOrgParent(model.root, sel.id);
    if (!p) return;
    const next = cloneOrg(model.root);
    const pn = findOrg(next, p.id);
    if (!pn) return;
    const src = findOrg(next, sel.id)!;
    const copy = cloneOrg(src);
    const reid = (n: typeof copy) => { n.id = newOrgId(); n.children.forEach(reid); };
    reid(copy);
    pn.children.push(copy);
    onChange({ ...model, root: next });
  };
  const del = () => {
    if (!sel || sel.id === model.root.id) return;
    const next = cloneOrg(model.root);
    const p = findOrgParent(next, sel.id);
    if (!p) return;
    p.children = p.children.filter((c) => c.id !== sel.id);
    onSelect(null);
    onChange({ ...model, root: next });
  };
  const toggleCollapse = () => {
    if (!sel) return;
    patch(sel.id, { collapsed: !sel.collapsed });
  };

  const shellClass = expanded
    ? "fixed inset-y-0 right-0 z-50 w-[clamp(320px,33vw,440px)] shadow-2xl border-l border-border overflow-hidden flex flex-col"
    : "fixed inset-y-0 right-0 z-50 w-11 shadow-2xl border-l border-border overflow-hidden flex flex-col items-center";
  const panelStyle = { background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

  const fold = (
    <button type="button" onClick={() => setExpanded((v) => !v)}
      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted/60">
      {expanded ? "›" : "⚙"}
    </button>
  );

  if (!expanded) {
    return createPortal(<aside className={shellClass} style={panelStyle}
      onMouseDown={guard} onPointerDown={guard} onClick={guard}>
      <div className="pt-3">{fold}</div>
    </aside>, document.body);
  }

  return createPortal(
    <div className={shellClass} style={panelStyle} onMouseDown={guard} onPointerDown={guard} onClick={guard}>
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">{fold}<div className="text-sm font-semibold">Logic / organisation</div></div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Layout</div>
          <div className="flex flex-wrap gap-1.5">
            {(["TB","BT","LR","RL","radial","free"] as OrgDirection[]).map((d) => (
              <button key={d}
                className={`px-2 py-1 border rounded ${model.direction === d ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => onChange({ ...model, direction: d })}>{d}</button>
            ))}
          </div>
        </section>

        {sel ? (
          <>
            <section className="space-y-2 border-t pt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Node</div>
              <label className="flex items-center gap-2">
                <span className="w-20">Text</span>
                <input value={sel.text} onChange={(e) => patch(sel.id, { text: e.target.value })}
                  className="flex-1 border rounded px-2 py-1 bg-background"/>
              </label>
              <div className="flex items-center gap-2">
                <span className="w-20">Shape</span>
                <div className="flex flex-wrap gap-1">
                  {SHAPES.map((s) => (
                    <button key={s.v} className={`px-2 py-0.5 border rounded ${sel.shape === s.v ? "bg-muted" : ""}`}
                      onClick={() => patch(sel.id, { shape: s.v })}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20">Fill</span>
                <input type="color" value={sel.color} onChange={(e) => patch(sel.id, { color: e.target.value })}/>
                <span className="w-20">Border</span>
                <input type="color" value={sel.border} onChange={(e) => patch(sel.id, { border: e.target.value })}/>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button className="px-2 py-1 border rounded bg-primary text-primary-foreground" onClick={addChild}>+ Add child</button>
                <button className="px-2 py-1 border rounded" onClick={duplicate}>Duplicate</button>
                <button className="px-2 py-1 border rounded" onClick={toggleCollapse}>
                  {sel.collapsed ? "Expand" : "Collapse"}
                </button>
                {sel.id !== model.root.id && (
                  <button className="px-2 py-1 border rounded text-destructive" onClick={del}>Delete</button>
                )}
              </div>
            </section>

            {sel.id !== model.root.id && (
              <section className="space-y-2 border-t pt-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Incoming edge</div>
                <div className="flex items-center gap-2">
                  <span className="w-20">Style</span>
                  {(["straight","curved"] as const).map((s) => (
                    <button key={s} className={`px-2 py-0.5 border rounded ${sel.edge.style === s ? "bg-muted" : ""}`}
                      onClick={() => patchEdge(sel.id, { style: s })}>{s}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20">Arrow</span>
                  {(["none","single","double"] as const).map((a) => (
                    <button key={a} className={`px-2 py-0.5 border rounded ${sel.edge.arrow === a ? "bg-muted" : ""}`}
                      onClick={() => patchEdge(sel.id, { arrow: a })}>{a}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20">Dash</span>
                  {(["solid","dashed"] as const).map((d) => (
                    <button key={d} className={`px-2 py-0.5 border rounded ${sel.edge.dash === d ? "bg-muted" : ""}`}
                      onClick={() => patchEdge(sel.id, { dash: d })}>{d}</button>
                  ))}
                </div>
                <label className="flex items-center gap-2">
                  <span className="w-20">Label</span>
                  <input value={sel.edge.label} onChange={(e) => patchEdge(sel.id, { label: e.target.value })}
                    className="flex-1 border rounded px-2 py-1 bg-background"/>
                </label>
              </section>
            )}
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
