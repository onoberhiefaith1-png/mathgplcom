// SelectionInspector — small strip to edit the selected object's label,
// length, value, or marks.

import type { GeometryScene, GeoObject } from "@/lib/geometry/scene";
import { patchObject } from "@/lib/geometry/editor/sceneOps";

interface Props {
  scene: GeometryScene;
  selected: GeoObject[];
  onApply: (next: GeometryScene) => void;
}

export function SelectionInspector({ scene, selected, onApply }: Props) {
  if (selected.length === 0) {
    return (
      <p className="text-[11px] text-foreground/55">
        Tip: choose a tool from the left, or click an object to inspect it.
      </p>
    );
  }
  const o = selected[0];

  const set = (patch: Partial<GeoObject>) => onApply(patchObject(scene, o.id, patch).scene);

  return (
    <div className="space-y-2 text-xs">
      <p className="text-[10px] uppercase tracking-wider text-foreground/55">
        {o.type} · {o.id}
      </p>

      {(o.type === "point" || o.type === "segment" || o.type === "circle") && (
        <Row label="Label">
          <input
            value={(o as any).label ?? ""}
            onChange={(e) => set({ label: e.target.value } as any)}
            placeholder={o.type === "point" ? "A" : "AB"}
            className="w-full bg-transparent border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
          />
        </Row>
      )}

      {o.type === "segment" && (
        <>
          <Row label="Length">
            <input
              value={o.length ?? ""}
              onChange={(e) => set({ length: e.target.value } as any)}
              placeholder='e.g. 5 cm'
              className="w-full bg-transparent border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
            />
          </Row>
          <Row label="Marks">
            <select
              value={o.marks ?? ""}
              onChange={(e) => set({ marks: (e.target.value || null) as any })}
              className="w-full bg-transparent border border-foreground/20 rounded px-1 py-1"
            >
              <option value="">(none)</option>
              <option value="tick">tick</option>
              <option value="double">double</option>
              <option value="triple">triple</option>
              <option value="right">right-angle</option>
              <option value="parallel">parallel</option>
              <option value="double-parallel">double parallel</option>
              <option value="triple-parallel">triple parallel</option>
            </select>
          </Row>
          <Row label="Dashed">
            <input
              type="checkbox"
              checked={!!o.dashed}
              onChange={(e) => set({ dashed: e.target.checked } as any)}
            />
          </Row>
        </>
      )}

      {o.type === "angle" && (
        <>
          <Row label="Value">
            <input
              value={o.value ?? ""}
              onChange={(e) => set({ value: e.target.value } as any)}
              placeholder="45°, x°, θ"
              className="w-full bg-transparent border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
            />
          </Row>
          <Row label="Marker">
            <select
              value={o.marker ?? "arc"}
              onChange={(e) => set({ marker: e.target.value as any })}
              className="w-full bg-transparent border border-foreground/20 rounded px-1 py-1"
            >
              <option value="arc">arc</option>
              <option value="double">double</option>
              <option value="right">right angle</option>
            </select>
          </Row>
        </>
      )}

      {o.type === "circle" && (
        <Row label="Radius">
          <input
            type="number"
            value={o.r}
            onChange={(e) => set({ r: Number(e.target.value) } as any)}
            className="w-full bg-transparent border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
          />
        </Row>
      )}

      {o.type === "label" && (
        <Row label="Text">
          <input
            value={o.text}
            onChange={(e) => set({ text: e.target.value } as any)}
            className="w-full bg-transparent border border-foreground/20 rounded px-1.5 py-1 outline-none focus:border-primary"
          />
        </Row>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[80px_1fr] items-center gap-2">
      <span className="text-[11px] text-foreground/60">{label}</span>
      <span>{children}</span>
    </label>
  );
}
