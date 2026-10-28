// ReviewPropertiesPanel — the Smartboard's ~1/5-width review dock for the
// teacher-authored Geometry Map of the diagram currently on the board.
//
// It never generates, solves or infers mathematics. It retrieves the items
// stored on THIS diagram's scene, lists the ones linked BY OBJECT IDENTITY to
// the selected part, and reports the objects a picked item refers to so the
// board can light them up. Diagram → property and property → diagram.

import { useMemo } from "react";
import { X } from "lucide-react";
import type { GeometryScene } from "@/lib/geometry/scene";
import { MathText } from "@/lib/geometry/map/renderStatement";
import { ColoredMathText } from "@/lib/geometry/map/renderTokens";
import { describeObject } from "@/lib/geometry/properties/model";
import {
  itemsForObjects,
  itemTokenColors,
  objectColor,
  objectChipLabel,
  readMap,
  reviewableMapItems,
  type GeometryMapItem,
} from "@/lib/geometry/map/model";

interface Props {
  scene: GeometryScene;
  role: "teacher" | "student";
  /** The geometry objects the user tapped on the board, in order. */
  selectedObjectIds: string[];
  /** Clear every tapped part. */
  onReset?: () => void;
  activePropertyId: string | null;
  onPickProperty: (item: GeometryMapItem | null) => void;
  onClose: () => void;
  fg?: string;
  bg?: string;
  border?: string;
  accent?: string;
}

export function ReviewPropertiesPanel({
  scene,
  role,
  selectedObjectIds,
  onReset,
  activePropertyId,
  onPickProperty,
  onClose,
  fg = "#0f172a",
  bg = "#ffffff",
  border = "rgba(15,23,42,0.14)",
  accent = "#2563eb",
}: Props) {
  const doc = useMemo(() => readMap(scene), [scene]);
  const items = useMemo(() => reviewableMapItems(doc, role), [doc, role]);
  const shown = useMemo(
    () => itemsForObjects(items, selectedObjectIds),
    [items, selectedObjectIds],
  );
  const hasSelection = selectedObjectIds.length > 0;
  const single = selectedObjectIds.length === 1
    ? describeObject(scene, selectedObjectIds[0])
    : null;
  const selectedNames = selectedObjectIds.map((id) => ({
    id,
    name: objectChipLabel(scene, id),
    color: objectColor(doc, id),
  }));

  return (
    <aside
      className="flex h-full w-full flex-col overflow-hidden border-l"
      style={{ background: bg, color: fg, borderColor: border }}
    >
      <header
        className="flex items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: border }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider">
          Review properties
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close review properties"
          className="rounded p-1 hover:bg-black/5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!hasSelection && (
          <p className="text-[11.5px] leading-snug opacity-70">
            Tap a point, side, angle or area on the diagram to see the properties
            the teacher attached to it.
          </p>
        )}

        {hasSelection && (
          <>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider opacity-60">
                  {single?.typeLabel ?? "Selected parts"}
                </p>
                <p className="text-[15px] font-semibold leading-snug">
                  {selectedNames.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && <span className="opacity-50"> · </span>}
                      <span style={r.color ? { color: r.color } : undefined}>{r.name}</span>
                    </span>
                  ))}
                </p>
              </div>
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-black/5"
                  style={{ borderColor: border }}
                >
                  Reset
                </button>
              )}
            </div>

            {shown.length === 0 && (
              <p className="text-[11.5px] leading-snug opacity-70">
                {selectedObjectIds.length > 1 ? "No property connects these parts." : "No properties are attached to this part."}
              </p>
            )}

            <ul className="space-y-1.5">
              {shown.map((item) => {
                const active = item.id === activePropertyId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onPickProperty(active ? null : item)}
                      className="w-full rounded-md border p-2 text-left transition-colors"
                      style={{
                        borderColor: active ? accent : border,
                        background: active ? `${accent}1a` : "transparent",
                      }}
                    >
                      {item.principle && (
                        <p className="text-[12px] font-semibold leading-snug">
                          <MathText value={item.principle} />
                        </p>
                      )}
                      <p className="text-[14px] leading-snug">
                        <ColoredMathText
                          value={item.boardText || item.relation}
                          tokens={itemTokenColors(doc, item)}
                          colorForObject={(oid) => objectColor(doc, oid)}
                        />

                      </p>
                      {item.explanation && (
                        <p className="mt-0.5 text-[11px] leading-snug opacity-70">
                          {item.explanation}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <footer
        className="border-t px-3 py-1.5 text-[10.5px] leading-snug opacity-60"
        style={{ borderColor: border }}
      >
        Tap a property to light up the parts of the diagram it applies to.
      </footer>
    </aside>
  );
}

export default ReviewPropertiesPanel;
