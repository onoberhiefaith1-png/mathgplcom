// Right-hand panel listing every mathematical relationship that applies
// to the current selection. Two viewing modes: Relationship (generic
// formula + mini diagram) and Apply (formula instantiated with the values
// from the actual selection).

import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useSmartGeometry } from "./SmartGeometryContext";
import { derivedFor } from "@/lib/geometry/smart/evaluate";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { openGeometryAiEdit } from "@/components/lessonnotes/extensions/GeometryDiagram";
import type { GeometryScene } from "@/lib/geometry/scene";

interface Props {
  scene: GeometryScene;
  topic?: string;
  onApply: (next: GeometryScene) => void;
}

export function RelationshipPanel({ scene, topic, onApply }: Props) {
  const { selectedParts, theorems, mode, setMode, graph } = useSmartGeometry();
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  const empty = selectedParts.length === 0;

  return (
    <aside
      data-smart-relationship-panel="true"
      contentEditable={false}
      className="w-72 shrink-0 border-l border-foreground/10 bg-background/50 backdrop-blur-sm px-3 py-3 text-sm"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold tracking-wide text-foreground/70 uppercase">Relationships</h4>
        <div className="inline-flex rounded-md overflow-hidden border border-foreground/15 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("relation")}
            className={cn("px-2 py-0.5", mode === "relation" ? "bg-primary text-primary-foreground" : "hover:bg-foreground/5")}
          >Generic</button>
          <button
            type="button"
            onClick={() => setMode("apply")}
            className={cn("px-2 py-0.5", mode === "apply" ? "bg-primary text-primary-foreground" : "hover:bg-foreground/5")}
          >Apply</button>
        </div>
      </div>

      {/* Selection summary */}
      <div className="mb-2">
        {empty ? (
          <p className="text-xs text-foreground/60">Click an object in the diagram to see its mathematical relationships.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedParts.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {p.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Derived values for single selection */}
      {selectedParts.length === 1 && (
        <div className="mb-3 rounded-md border border-foreground/10 bg-foreground/[0.02] px-2 py-1.5 text-[11px]">
          {derivedFor(selectedParts[0], graph).map((d) => (
            <div key={d.label} className="flex justify-between gap-2">
              <span className="text-foreground/60">{d.label}</span>
              <span className="font-mono">{d.value}</span>
            </div>
          )) || null}
          {derivedFor(selectedParts[0], graph).length === 0 && (
            <span className="text-foreground/50">No derived values.</span>
          )}
        </div>
      )}

      {/* Theorems */}
      <div className="space-y-1.5">
        {!empty && theorems.length === 0 && (
          <p className="text-xs text-foreground/60 italic">No matching theorem yet — select another related object.</p>
        )}
        {theorems.map((t) => {
          const open = openIds[t.id] ?? false;
          const applied = mode === "apply" ? t.apply(selectedParts, graph) : null;
          return (
            <Collapsible
              key={t.id}
              open={open}
              onOpenChange={(v) => setOpenIds((p) => ({ ...p, [t.id]: v }))}
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-start gap-1.5 text-left px-2 py-1.5 rounded-md border border-foreground/10 hover:bg-foreground/[0.04] transition"
                >
                  {open ? <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                  <span className="flex-1">
                    <span className="block text-[12px] font-semibold text-foreground">{t.name}</span>
                    <span className="block text-[11px] font-mono text-foreground/70">
                      {mode === "apply" && applied ? applied.equation : t.formula}
                    </span>
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pt-1 pb-2 text-[11px] text-foreground/70 space-y-1">
                <p>{t.why}</p>
                {mode === "apply" && applied?.explanation && <p className="italic">{applied.explanation}</p>}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* AI edit on selection */}
      {!empty && (
        <button
          type="button"
          onClick={() => openGeometryAiEdit({
            scene: {
              ...scene,
              meta: {
                ...(scene.meta ?? {}),
                caption: scene.meta?.caption,
                topic: scene.meta?.topic ?? topic,
              },
            },
            topic: `${topic ?? ""}\nSelected: ${selectedParts.map((p) => p.label).join(", ")}`,
            onApply,
          })}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-[12px] px-2 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" /> AI Edit selection
        </button>
      )}
    </aside>
  );
}
