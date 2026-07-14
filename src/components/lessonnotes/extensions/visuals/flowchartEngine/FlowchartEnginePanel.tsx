import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { FlowLayout, FlowModel, FlowNode, FlowShapeKind } from "./types";
import { makeFlowNode, newId } from "./types";
import { autoLayout } from "./layout";

interface Props {
  open: boolean;
  onClose: () => void;
  model: FlowModel;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (m: FlowModel) => void;
  connectFrom: string | null;
  onSetConnectFrom: (id: string | null) => void;
  onDeleteDiagram?: () => void;
}

const SHAPES: { kind: FlowShapeKind; label: string }[] = [
  { kind: "start", label: "Start" },
  { kind: "end", label: "End" },
  { kind: "process", label: "Process" },
  { kind: "decision", label: "Decision" },
  { kind: "io", label: "Input / Output" },
  { kind: "connector", label: "Connector" },
  { kind: "comment", label: "Comment" },
];

export function FlowchartEnginePanel({ open, onClose, model, selectedId, onSelect, onChange, connectFrom, onSetConnectFrom, onDeleteDiagram }: Props) {
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

  const sel = model.nodes.find((n) => n.id === selectedId) || null;

  const insertShape = (kind: FlowShapeKind) => {
    const n = makeFlowNode(kind, 60 + Math.random() * 200, 60 + Math.random() * 200);
    onChange({ ...model, layout: "free", nodes: [...model.nodes, n] });
    onSelect(n.id);
  };

  const patchNode = (patch: Partial<typeof sel>) => {
    if (!sel) return;
    onChange({ ...model, nodes: model.nodes.map((n) => n.id === sel.id ? { ...n, ...patch } : n) });
  };

  const duplicate = () => {
    if (!sel) return;
    const copy = { ...sel, id: newId("n"), x: sel.x + 24, y: sel.y + 24 };
    onChange({ ...model, layout: "free", nodes: [...model.nodes, copy] });
    onSelect(copy.id);
  };
  const remove = () => {
    if (!sel) return;
    onChange({
      ...model,
      nodes: model.nodes.filter((n) => n.id !== sel.id),
      edges: model.edges.filter((e) => e.from !== sel.id && e.to !== sel.id),
    });
    onSelect(null);
  };

  const applyLayout = (l: FlowLayout) => {
    onChange(autoLayout({ ...model, layout: l }));
  };

  const shellClass = expanded
    ? "fixed inset-y-0 right-0 z-50 w-[clamp(320px,33vw,440px)] shadow-2xl border-l border-border overflow-hidden flex flex-col"
    : "fixed inset-y-0 right-0 z-50 w-11 shadow-2xl border-l border-border overflow-hidden flex flex-col items-center";
  const panelStyle = { background: "hsl(var(--background))", color: "hsl(var(--foreground))" };
  const foldButton = (
    <button type="button" onClick={() => setExpanded((v) => !v)}
      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted/60">
      {expanded ? "›" : "⚙"}
    </button>
  );

  if (!expanded) {
    return createPortal(
      <aside className={shellClass} style={panelStyle} onMouseDown={guard} onPointerDown={guard} onClick={guard}>
        <div className="pt-3">{foldButton}</div>
      </aside>, document.body);
  }

  return createPortal(
    <div className={shellClass} style={panelStyle} onMouseDown={guard} onPointerDown={guard} onClick={guard}>
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          {foldButton}
          <div className="text-sm font-semibold">Flowchart</div>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Insert</div>
          <div className="grid grid-cols-2 gap-1.5">
            {SHAPES.map((s) => (
              <button key={s.kind} className="px-2 py-1 border rounded text-left hover:bg-muted/40"
                onClick={() => insertShape(s.kind)}>{s.label}</button>
            ))}
          </div>
        </section>

        <section className="space-y-2 border-t pt-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Layout</div>
          <div className="flex flex-wrap gap-1.5">
            {(["horizontal","vertical","tree","radial","free"] as FlowLayout[]).map((l) => (
              <button key={l}
                className={`px-2 py-1 border rounded ${model.layout === l ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => applyLayout(l)}>{l}</button>
            ))}
          </div>
        </section>

        {sel && (
          <section className="space-y-2 border-t pt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Shape · {sel.kind}</div>
            <label className="flex items-center gap-2">
              <span className="w-20">Text</span>
              <input value={sel.text} onChange={(e) => patchNode({ text: e.target.value })}
                className="flex-1 border rounded px-2 py-1 bg-background"/>
            </label>
            <div className="flex items-center gap-2">
              <span className="w-20">Width</span>
              <input type="range" min={40} max={280} value={sel.w}
                onChange={(e) => patchNode({ w: Number(e.target.value) })} className="flex-1"/>
              <span className="w-8 text-right">{sel.w}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20">Height</span>
              <input type="range" min={30} max={200} value={sel.h}
                onChange={(e) => patchNode({ h: Number(e.target.value) })} className="flex-1"/>
              <span className="w-8 text-right">{sel.h}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20">Radius</span>
              <input type="range" min={0} max={40} value={sel.radius}
                onChange={(e) => patchNode({ radius: Number(e.target.value) })} className="flex-1"/>
              <span className="w-8 text-right">{sel.radius}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20">Fill</span>
              <input type="color" value={sel.fill} onChange={(e) => patchNode({ fill: e.target.value })}/>
              <span className="w-20">Border</span>
              <input type="color" value={sel.border} onChange={(e) => patchNode({ border: e.target.value })}/>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20">Align</span>
              {(["left","center","right"] as const).map((a) => (
                <button key={a} className={`px-2 py-0.5 border rounded ${sel.align === a ? "bg-muted" : ""}`}
                  onClick={() => patchNode({ align: a })}>{a}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button className="px-2 py-1 border rounded bg-primary text-primary-foreground"
                onClick={() => onSetConnectFrom(connectFrom === sel.id ? null : sel.id)}>
                {connectFrom === sel.id ? "Cancel connect" : "Connect →"}
              </button>
              <button className="px-2 py-1 border rounded" onClick={duplicate}>Duplicate</button>
              <button className="px-2 py-1 border rounded text-destructive" onClick={remove}>Delete</button>
            </div>
            <div className="text-muted-foreground text-[10px]">
              Tip: click Connect → then click a target shape.
            </div>
          </section>
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
