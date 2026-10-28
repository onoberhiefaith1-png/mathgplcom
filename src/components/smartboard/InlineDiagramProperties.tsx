// The tapped part's properties, written straight under the diagram like a
// line of text. It sits in normal page flow, so everything beneath moves down
// to make room and nothing is ever covered. Same teacher-authored Geometry Map
// data as the review panel; no side bar, no second surface.

import { memo, useMemo } from "react";
import { X } from "lucide-react";
import type { GeometryScene } from "@/lib/geometry/scene";
import { MathText } from "@/lib/geometry/map/renderStatement";
import { ColoredMathText } from "@/lib/geometry/map/renderTokens";
import {
  itemObjectIds,
  itemsForObjects,
  itemTokenColors,
  objectColor,
  readMap,
  reviewableMapItems,
} from "@/lib/geometry/map/model";
import { reviewProperties } from "@/lib/smartboard/reviewProperties";

export const InlineDiagramProperties = memo(function InlineDiagramProperties({
  scene,
  role,
  selectedObjectIds,
  activePropertyId,
}: {
  scene: GeometryScene;
  role: "teacher" | "student";
  selectedObjectIds: string[];
  activePropertyId: string | null;
}) {
  const doc = useMemo(() => readMap(scene), [scene]);
  const items = useMemo(() => reviewableMapItems(doc, role), [doc, role]);
  const shown = useMemo(() => itemsForObjects(items, selectedObjectIds), [items, selectedObjectIds]);
  if (selectedObjectIds.length === 0) return null;

  return (
    <div
      data-inline-diagram-properties
      className="relative mt-3 w-full min-w-0 pr-7 text-left"
      style={{ fontSize: "0.6em", lineHeight: 1.45, whiteSpace: "normal" }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => reviewProperties.resetSelection()}
        aria-label="Remove properties"
        className="absolute right-0 top-0 rounded-full p-1 opacity-60 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
      {shown.length === 0 ? (
        <p className="opacity-70">No properties are attached to this part.</p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((item) => {
            const active = item.id === activePropertyId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => reviewProperties.pickProperty(active ? null : item.id, active ? [] : itemObjectIds(item))}
                  className={`w-full text-left ${active ? "underline decoration-2 underline-offset-4" : ""}`}
                >
                  {item.principle ? (
                    <span className="block text-[0.8em] font-semibold opacity-80"><MathText value={item.principle} /></span>
                  ) : null}
                  <span className="block">
                    <ColoredMathText
                      value={item.boardText || item.relation}
                      tokens={itemTokenColors(doc, item)}
                      colorForObject={(oid) => objectColor(doc, oid)}
                    />
                  </span>
                  {item.explanation ? (
                    <span className="block text-[0.75em] opacity-70">{item.explanation}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

export default InlineDiagramProperties;
