// ReviewPropertiesPanel — the Smartboard's ~1/5-width review dock for the
// teacher-authored Geometry Properties of the diagram currently on the board.
//
// It never generates, solves or infers mathematics. It retrieves the properties
// stored on THIS diagram's scene, lists the ones referencing the selected
// geometry object, and reports the objects a picked property refers to so the
// board can light them up. Diagram → property and property → diagram.

import { useMemo } from "react";
import { X } from "lucide-react";
import type { GeometryScene } from "@/lib/geometry/scene";
import { MathText } from "@/lib/geometry/map/renderStatement";
import {
  describeTarget,
  readProperties,
  type GeometryPropertyItem,
} from "@/lib/geometry/properties/model";
import {
  itemsForObjectId,
  propertyObjectIds,
  reviewableItems,
} from "@/lib/geometry/properties/review";

interface Props {
  scene: GeometryScene;
  role: "teacher" | "student";
  /** The geometry object the user clicked on the board, if any. */
  selectedObjectId: string | null;
  activePropertyId: string | null;
  onPickProperty: (item: GeometryPropertyItem | null) => void;
  onClose: () => void;
  fg?: string;
  bg?: string;
  border?: string;
  accent?: string;
}

export function ReviewPropertiesPanel({
  scene,
  role,
  selectedObjectId,
  activePropertyId,
  onPickProperty,
  onClose,
  fg = "#0f172a",
  bg = "#ffffff",
  border = "rgba(15,23,42,0.14)",
  accent = "#2563eb",
}: Props) {
  const doc = useMemo(() => readProperties(scene), [scene]);
  const items = useMemo(() => reviewableItems(doc, role), [doc, role]);
  const shown = useMemo(
    () => (selectedObjectId ? itemsForObjectId(doc, items, selectedObjectId) : []),
    [doc, items, selectedObjectId],
  );
  const target = useMemo(
    () => describeTarget(scene, doc, selectedObjectId),
    [scene, doc, selectedObjectId],
  );

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
        {!selectedObjectId && (
          <p className="text-[11.5px] leading-snug opacity-70">
            Tap a point, side, angle or area on the diagram to see the properties
            the teacher attached to it.
          </p>
        )}

        {selectedObjectId && (
          <>
            <p className="text-[11px] uppercase tracking-wider opacity-60">
              {target?.typeLabel ?? "Selected"}
            </p>
            <p className="mb-2 text-[15px] font-semibold leading-snug">
              {target?.name ?? "Selected object"}
            </p>

            {shown.length === 0 && (
              <p className="text-[11.5px] leading-snug opacity-70">
                No properties are attached to this part.
              </p>
            )}

            <ul className="space-y-1.5">
              {shown.map((item) => {
                const active = item.id === activePropertyId;
                const refs = propertyObjectIds(doc, item)
                  .map((id) => describeTarget(scene, doc, id)?.name)
                  .filter((n): n is string => !!n);
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
                      <p className="text-[14px] leading-snug">
                        <MathText value={item.content} />
                      </p>
                      {item.reason && (
                        <p className="mt-0.5 text-[11px] leading-snug opacity-70">
                          {item.reason}
                        </p>
                      )}
                      {refs.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {refs.map((name, i) => (
                            <span
                              key={`${name}-${i}`}
                              className="rounded-full border px-1.5 py-[1px] text-[10px]"
                              style={{ borderColor: border }}
                            >
                              {name}
                            </span>
                          ))}
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
