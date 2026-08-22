// GeometryGuideView — the student-facing, read-only Geometry Map.
//
// It shows the theory pathway of the solution, in order: each step names the
// principle used, states it symbolically, and lights up the parts of the
// diagram it applies to. No AI, no editing, no numbers.

import { useState } from "react";
import { ChevronDown, ChevronRight, Route } from "lucide-react";
import type { GeometryScene } from "@/lib/geometry/scene";
import {
  keepLiveIds,
  objectChipLabel,
  publishedMapItems,
  readMap,
  type GeometryMapItem,
} from "@/lib/geometry/map/model";

export function GeometryGuideView({
  scene, onHighlight,
}: {
  scene: GeometryScene;
  /** Highlights the step's objects on the diagram above. */
  onHighlight?: (ids: string[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const doc = readMap(scene);
  const items = publishedMapItems(doc);

  if (items.length === 0) return null;

  const pick = (item: GeometryMapItem) => {
    const next = activeId === item.id ? null : item.id;
    setActiveId(next);
    onHighlight?.(next ? keepLiveIds(scene, item.objectIds) : []);
  };

  return (
    <div className="mt-2 rounded-lg border border-foreground/15 bg-foreground/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px] font-medium"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Route className="h-3.5 w-3.5 opacity-70" />
        How this was solved
        <span className="ml-1 text-[11px] font-normal text-foreground/50">
          ({items.length} steps)
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-foreground/10 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
            Theory pathway
          </p>
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              className={`block w-full rounded border p-2 text-left transition-colors ${
                activeId === item.id
                  ? "border-primary bg-primary/10"
                  : "border-foreground/10 bg-background/70 hover:bg-foreground/[0.04]"
              }`}
            >
              <div className="flex items-start gap-1.5">
                <span className="mt-[1px] inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-foreground/10 text-[9.5px] font-semibold">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-snug">
                    <MathText value={item.principle} />
                  </p>
                  {item.relation && (
                    <p className="text-[12.5px] leading-snug">
                      <MathText value={item.relation} />
                    </p>
                  )}

                  {item.explanation && (
                    <p className="text-[10.5px] leading-snug text-foreground/60">
                      {item.explanation}
                    </p>
                  )}
                  {item.usedTo && (
                    <p className="text-[10.5px] text-foreground/55">{item.usedTo}</p>
                  )}
                  {item.objectIds.length > 0 && (
                    <p className="mt-0.5 flex flex-wrap gap-1">
                      {item.objectIds.map((id) => (
                        <span
                          key={id}
                          className="rounded-full border border-foreground/20 px-1.5 py-[1px] text-[10px]"
                        >
                          {objectChipLabel(scene, id)}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
          <p className="pt-0.5 text-[10.5px] text-foreground/50">
            Tap a step to light up the parts of the diagram it uses.
          </p>
        </div>
      )}
    </div>
  );
}

export default GeometryGuideView;
