// SmartboardPropertyTest — the teacher's rehearsal of exactly what a student
// gets on the Smartboard for THIS diagram.
//
// It reuses the presentation renderer and the board's own Review Properties
// dock, so nothing is re-implemented and nothing is regenerated: clicking a
// part lists the properties linked to that part by object identity, and
// clicking a property lights up the parts it refers to.

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { PresentationGeometryDiagram } from "@/components/lessonnotes/extensions/GeometryDiagram";
import { ReviewPropertiesPanel } from "@/components/smartboard/ReviewPropertiesPanel";
import { itemObjectIds, type GeometryMapItem } from "@/lib/geometry/map/model";
import type { GeometryScene } from "@/lib/geometry/scene";

export function SmartboardPropertyTest({
  scene,
  onClose,
}: {
  scene: GeometryScene;
  onClose: () => void;
}) {
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);

  const board = useMemo(
    () => (
      <PresentationGeometryDiagram
        scene={scene}
        highlightIds={highlightIds}
        onPickObject={(id) => {
          setSelectedObjectId(id);
          setActiveId(null);
          setHighlightIds([id]);
        }}
      />
    ),
    [scene, highlightIds],
  );

  const pick = (item: GeometryMapItem | null) => {
    if (!item) {
      setActiveId(null);
      setHighlightIds(selectedObjectId ? [selectedObjectId] : []);
      return;
    }
    setActiveId(item.id);
    setHighlightIds(itemObjectIds(item));
  };

  return (
    <div className="fixed inset-0 z-[120] flex bg-[#0b1120] text-white">
      <div className="relative flex min-w-0 flex-1 items-center justify-center p-6">
        <div className="rounded-lg bg-white p-4 shadow-2xl">{board}</div>

        <div className="absolute left-4 top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-2.5 py-1.5 text-[12px] font-medium hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" /> Close test
          </button>
          <div className="flex overflow-hidden rounded-md border border-white/25 text-[11.5px]">
            {(["student", "teacher"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`px-2.5 py-1.5 ${role === r ? "bg-white text-[#0b1120]" : "hover:bg-white/10"}`}
              >
                As {r}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-white/60">
            Smartboard test · tap a part of the diagram
          </span>
        </div>
      </div>

      <div className="h-full w-[20%] min-w-[240px]">
        <ReviewPropertiesPanel
          scene={scene}
          role={role}
          selectedObjectId={selectedObjectId}
          activePropertyId={activeId}
          onPickProperty={pick}
          onClose={onClose}
          fg="#0f172a"
          bg="#ffffff"
          border="rgba(15,23,42,0.14)"
          accent="#2563eb"
        />
      </div>
    </div>
  );
}

export default SmartboardPropertyTest;
