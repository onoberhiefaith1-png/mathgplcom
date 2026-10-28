// Dynamic property panel. Two modes:
//   1. No component selected  → shows the diagram-level SmartGeometryEditor
//      (Rotate / Expand / Adjust / Add Component) plus a Components list.
//   2. A component is selected → shows sections registered for that kind.

import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { Adapter } from "../shapes";
import type { AttrsAdapter } from "../attrsAdapters";
import type { Nodes } from "../geometry";
import type { LiveComponent, Visibility } from "../schema";
import { SmartGeometryEditor } from "../SmartGeometryEditor";
import type { PickTool } from "../LivingCanvas";
import {
  type Component, type ComponentKind, displayName,
  patchComponent, removeComponent,
} from "./componentModel";
import {
  IdentitySection, AppearanceSection, LineSection, VertexSection,
  AngleSection, LabelSection, MeasurementSection, FillSection, BehaviourSection,
} from "./sections";

interface Props {
  open: boolean;
  onClose: () => void;
  adapter: Adapter | null;
  attrsAdapter: AttrsAdapter;
  attrs: Record<string, unknown>;
  nodes: Nodes | null;
  nodeLabels: Record<string, string>;
  visibility: Visibility;
  viewScale: number;
  addOnComponents: LiveComponent[];
  components: Component[];
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
  onPatchAttrs: (patch: Record<string, unknown>) => void;
  onPatchComponents: (components: Component[]) => void;
  pickMode?: PickTool | null;
  onRequestPick?: (tool: PickTool | null) => void;
  onDeleteDiagram?: () => void;
}

const SECTION_MAP: Record<ComponentKind, React.FC<any>[]> = {
  line:        [IdentitySection, LineSection, AppearanceSection, LabelSection, MeasurementSection, BehaviourSection],
  vertex:      [IdentitySection, VertexSection, AppearanceSection, BehaviourSection],
  angle:       [IdentitySection, AngleSection, LabelSection, AppearanceSection, BehaviourSection],
  arc:         [IdentitySection, AppearanceSection, BehaviourSection],
  circle:      [IdentitySection, AppearanceSection, LabelSection, MeasurementSection, BehaviourSection],
  fill:        [IdentitySection, FillSection, BehaviourSection],
  label:       [IdentitySection, LabelSection, AppearanceSection, BehaviourSection],
  measurement: [IdentitySection, MeasurementSection, AppearanceSection, BehaviourSection],
  tick:        [IdentitySection, AppearanceSection, BehaviourSection],
  parallelMark:[IdentitySection, AppearanceSection, BehaviourSection],
  rightAngle:  [IdentitySection, AppearanceSection, BehaviourSection],
  arrow:       [IdentitySection, LineSection, AppearanceSection, BehaviourSection],
  region:      [IdentitySection, FillSection, LabelSection, BehaviourSection],
  face:        [IdentitySection, FillSection, AppearanceSection, BehaviourSection],
  edge:        [IdentitySection, LineSection, AppearanceSection, BehaviourSection],
  chord:       [IdentitySection, LineSection, LabelSection, MeasurementSection, BehaviourSection],
  radius:      [IdentitySection, LineSection, LabelSection, MeasurementSection, BehaviourSection],
  diameter:    [IdentitySection, LineSection, LabelSection, MeasurementSection, BehaviourSection],
  bar:         [IdentitySection, AppearanceSection, MeasurementSection, BehaviourSection],
  cell:        [IdentitySection, LabelSection, AppearanceSection, BehaviourSection],
  axis:        [IdentitySection, LineSection, AppearanceSection, BehaviourSection],
  marker:      [IdentitySection, AppearanceSection, LabelSection, BehaviourSection],
};

export function PropertyPanel(p: Props) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.open, p.onClose]);

  useEffect(() => {
    if (!p.open || typeof document === "undefined") return;
    const root = document.documentElement;
    const previousOffset = root.style.getPropertyValue("--geometry-panel-offset");
    root.style.setProperty("--geometry-panel-offset", expanded ? "clamp(320px, 33vw, 440px)" : "44px");
    return () => {
      if (previousOffset) root.style.setProperty("--geometry-panel-offset", previousOffset);
      else root.style.removeProperty("--geometry-panel-offset");
    };
  }, [p.open, expanded]);

  if (!p.open || typeof document === "undefined") return null;

  const selected = p.selectedComponentId
    ? p.components.find(c => c.id === p.selectedComponentId) ?? null
    : null;

  const guardPanelEvent = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  const patchSelectedComponent = (component: Component, patch: Partial<Component>) => {
    const nextComponents = patchComponent(p.components, component.id, patch);

    const nextLabel = patch.content?.label;
    if (component.kind === "vertex" && component.nodes?.[0] && typeof nextLabel === "string") {
      p.onPatchAttrs({
        parts: nextComponents,
        nodeLabels: { ...p.nodeLabels, [component.nodes[0]]: nextLabel },
      });
      return;
    }

    p.onPatchComponents(nextComponents);
  };

  const shellClass = expanded
    ? "fixed inset-y-0 right-0 z-50 w-[clamp(320px,33vw,440px)] shadow-2xl border-l border-border overflow-hidden flex flex-col"
    : "fixed inset-y-0 right-0 z-50 w-11 shadow-2xl border-l border-border overflow-hidden flex flex-col items-center";

  const panelStyle = { background: "hsl(var(--background))", color: "hsl(var(--foreground))" };

  const foldButton = (
    <button
      type="button"
      onClick={() => setExpanded(v => !v)}
      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-xs hover:bg-muted/60"
      title={expanded ? "Fold settings" : "Show settings"}
      aria-label={expanded ? "Fold settings" : "Show settings"}
    >
      {expanded ? "›" : "⚙"}
    </button>
  );

  if (!expanded) {
    return createPortal(
      <aside
        className={shellClass}
        style={panelStyle}
        onMouseDown={guardPanelEvent}
        onPointerDown={guardPanelEvent}
        onClick={guardPanelEvent}
        onKeyDown={guardPanelEvent}
      >
        <div className="pt-3">{foldButton}</div>
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          Settings
        </div>
      </aside>,
      document.body,
    );
  }

  // When a component is selected, render only its sections.
  if (selected) {
    const sections = SECTION_MAP[selected.kind] ?? [IdentitySection, BehaviourSection];
    return createPortal(
      <div
        className={shellClass}
        style={panelStyle}
        onMouseDown={guardPanelEvent}
        onPointerDown={guardPanelEvent}
        onClick={guardPanelEvent}
        onKeyDown={guardPanelEvent}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => p.onSelectComponent(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
              title="Back to diagram"
            >←</button>
            <h2 className="text-sm font-semibold truncate">{displayName(selected)}</h2>
          </div>
          <div className="flex items-center gap-2">
            {foldButton}
            <button onClick={p.onClose} className="text-xs text-muted-foreground hover:text-foreground">Close ✕</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-6 text-xs">
          {sections.map((S, i) => (
            <S
              key={i}
              component={selected}
              onPatch={(patch: Partial<Component>) =>
                patchSelectedComponent(selected, patch)
              }
              adapter={p.adapter}
              nodes={p.nodes}
              onPatchAttrs={p.onPatchAttrs}
              onDelete={() => {
                p.onPatchComponents(removeComponent(p.components, selected.id));
                p.onSelectComponent(null);
              }}
            />
          ))}
        </div>
      </div>,
      document.body,
    );
  }

  // Otherwise render the classic diagram-level editor + a Components list.
  return createPortal(
    <div
      className={shellClass}
      style={panelStyle}
      onMouseDown={guardPanelEvent}
      onPointerDown={guardPanelEvent}
      onClick={guardPanelEvent}
      onKeyDown={guardPanelEvent}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Smart Geometry Editor</h2>
        <div className="flex items-center gap-2">
          {foldButton}
          <button onClick={p.onClose} className="text-xs text-muted-foreground hover:text-foreground">Close ✕</button>
        </div>
      </header>

      {p.onDeleteDiagram && (
        <DeleteDiagramRow onDelete={() => { p.onDeleteDiagram!(); p.onClose(); }} />
      )}

      {p.components.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Components ({p.components.length})
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {p.components.map(c => (
              <button
                key={c.id}
                onClick={() => p.onSelectComponent(c.id)}
                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/60 flex items-center justify-between gap-2"
              >
                <span className="truncate">{displayName(c)}</span>
                <span className="text-[10px] text-muted-foreground">{c.kind}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Click a part of the diagram to edit only that piece.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <SmartGeometryEditor
          open={true}
          onClose={() => { /* no-op — shell handles close */ }}
          adapter={p.adapter}
          attrsAdapter={p.attrsAdapter}
          attrs={p.attrs}
          nodes={p.nodes}
          nodeLabels={p.nodeLabels}
          visibility={p.visibility}
          viewScale={p.viewScale}
          components={p.addOnComponents}
          parts={p.components}
          onSelectComponent={p.onSelectComponent}
          onPatchParts={p.onPatchComponents}
          onPatch={p.onPatchAttrs as any}
          pickMode={p.pickMode ?? null}
          onRequestPick={p.onRequestPick}
          embedded
        />
      </div>
    </div>,
    document.body,
  );
}

function DeleteDiagramRow({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div className="px-4 py-2 border-b border-border">
      {!armed ? (
        <button
          onClick={() => setArmed(true)}
          className="w-full text-[11px] text-destructive hover:bg-destructive/10 rounded px-2 py-1.5 border border-destructive/30"
        >
          🗑 Delete entire diagram
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-destructive">Delete diagram?</span>
          <button
            onClick={onDelete}
            className="text-[11px] px-2 py-1 rounded bg-destructive text-destructive-foreground hover:brightness-110"
          >Yes, delete</button>
          <button
            onClick={() => setArmed(false)}
            className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted/40"
          >Cancel</button>
        </div>
      )}
    </div>
  );
}
