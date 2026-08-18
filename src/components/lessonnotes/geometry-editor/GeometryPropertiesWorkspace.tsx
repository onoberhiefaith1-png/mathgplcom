// GeometryPropertiesWorkspace — the dedicated authoring workspace.
//
// It is NOT a second diagram: it mounts the very same GeometryScene in the
// existing GeometryWorkbench, and simply replaces the right-hand panel with
// the Geometry Properties authoring panel. Everything the teacher edits here
// is the same diagram that lives in the lesson note.
//
// The surface deliberately mirrors the Lesson Note page: a light desk with a
// white paper in the middle. The app's own tokens are dark, so they are
// re-declared locally — that is what keeps this workspace from opening as a
// dark screen.

import { useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Info } from "lucide-react";
import type { GeoId, GeometryScene } from "@/lib/geometry/scene";
import { GeometryWorkbench } from "./GeometryWorkbench";
import { GeometryMapPanel, type MapContext } from "./GeometryMapPanel";
import { keepLiveIds, readMap, writeMap } from "@/lib/geometry/map/model";

interface Props {
  scene: GeometryScene;
  onChange: (next: GeometryScene) => void;
  onClose: () => void;
  /** The question this diagram is bound to, and its saved solution. */
  context?: MapContext;
  /** Closes the workspace and puts the caret in that question's Solution. */
  onOpenSolution?: () => void;
  topic?: string;
}


/** Light surface tokens — the Lesson Note paper look, independent of theme. */
const LIGHT_TOKENS = {
  "--background": "0 0% 100%",
  "--foreground": "220 35% 18%",
  "--card": "0 0% 100%",
  "--card-foreground": "220 35% 18%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "220 35% 18%",
  "--primary": "221 83% 45%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "220 15% 94%",
  "--secondary-foreground": "220 35% 18%",
  "--muted": "220 15% 94%",
  "--muted-foreground": "220 12% 42%",
  "--accent": "203 85% 45%",
  "--accent-foreground": "0 0% 100%",
  "--border": "220 15% 84%",
  "--input": "220 15% 88%",
  "--ring": "221 83% 45%",
  background: "hsl(220 15% 94%)",
  color: "hsl(220 35% 18%)",
} as unknown as CSSProperties;

export function GeometryPropertiesWorkspace({
  scene, onChange, onClose, context, onOpenSolution, topic,
}: Props) {
  const [rawHighlight, setRawHighlight] = useState<GeoId[]>([]);
  const doc = readMap(scene);
  const empty = scene.objects.length === 0;
  const ctx: MapContext = context ?? {
    questionId: null, questionLabel: "", question: "", solution: "",
    solutionHash: "", hasSolution: false,
  };

  // Only ids that still exist in the diagram may glow.
  const highlightIds = useMemo(
    () => keepLiveIds(scene, rawHighlight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawHighlight.join(","), scene.objects.length],
  );

  const body = (
    <div className="fixed inset-0 z-[95] flex flex-col" style={LIGHT_TOKENS}>
      <header className="flex items-center gap-3 border-b border-black/10 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-md border border-black/15 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-black/5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Lesson Note
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-slate-900">
            Geometry Map{ctx.questionLabel ? ` — ${ctx.questionLabel}` : ""}
            <span className="font-normal text-slate-500"> · theory of this solution</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            Question → Solution → Map. Each step shows the principle used and lights up the
            parts of the diagram it applies to.
          </p>
        </div>
      </header>


      <div className="min-h-0 flex-1 overflow-hidden p-3">
        {empty ? (
          <div className="mx-auto flex h-full max-w-[1240px] items-center justify-center rounded-xl border border-black/10 bg-white shadow-sm">
            <div className="max-w-sm px-6 text-center">
              <Info className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              <p className="text-sm font-semibold text-slate-800">This diagram is empty</p>
              <p className="mt-1 text-[12px] leading-snug text-slate-500">
                Draw the diagram in the lesson note first, then come back here to attach
                relationships to its points, lines, angles and areas.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto h-full max-w-[1240px] overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
            <GeometryWorkbench
              scene={scene}
              onChange={onChange}
              className="h-full"
              hideLeftTools
              highlightIds={highlightIds}
              relatedIds={highlightIds}
              emphasisIds={highlightIds}
              rightPanelTitle="Geometry Map"
              rightPanelWidthClass="w-80"
              renderRightPanel={(editor) => (
                <GeometryMapPanel
                  scene={editor.scene}
                  doc={readMap(editor.scene)}
                  onDocChange={(next) => editor.commit(writeMap(editor.scene, next))}
                  targetId={editor.selectedIds[0] ?? null}
                  onHighlight={setRawHighlight}
                  context={ctx}
                  onOpenSolution={
                    onOpenSolution
                      ? () => { onClose(); onOpenSolution(); }
                      : undefined
                  }
                  topic={topic}
                />
              )}
            />
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/10 bg-white px-4 py-1.5 text-[11px] text-slate-500">
        <span className="flex items-center gap-3">
          <LegendDot color="#2563eb" label="Selected part" />
          <LegendDot color="#e11d48" label="Step subject" />
          <LegendDot color="#f59e0b" label="Related parts" />
        </span>
        <span>Click a step → the diagram lights up the parts that principle applies to.</span>
        <span>
        {doc.published
          ? `Map published to students — ${doc.items.filter((i) => i.enabled).length} steps visible.`
          : "Map is not published — students see the diagram only."}
        </span>
      </footer>

    </div>
  );

  return typeof document === "undefined" ? body : createPortal(body, document.body);
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export default GeometryPropertiesWorkspace;
