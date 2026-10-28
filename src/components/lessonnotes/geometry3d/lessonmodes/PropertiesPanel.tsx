// Lesson Mode: Properties of Solids — an auto-generated mathematical
// property card for the selected solid. No manual entry.

import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { solidProperties } from "@/lib/geometry3d/topology";
import { SOLID_DEFS, type Solid3D } from "@/lib/geometry3d/scene3d";

export function PropertiesPanel({ solid }: { solid: Solid3D | null }) {
  const props = useMemo(
    () => (solid ? solidProperties(solid, SOLID_DEFS[solid.kind].label) : null),
    [solid],
  );

  if (!solid || !props) {
    return (
      <div className="h-full border-l border-foreground/10 bg-background p-4">
        <p className="text-xs text-muted-foreground">
          Click a solid in the workspace to see its mathematical properties.
        </p>
      </div>
    );
  }

  const rows: [string, string][] = [
    ["Mathematical name", props.name],
    ["Shape family", props.family],
    ["Faces", String(props.faces)],
    ["Edges", String(props.edges)],
    ["Vertices", String(props.vertices)],
    ["Flat surfaces", String(props.flatFaces)],
    ["Curved surfaces", String(props.curvedFaces)],
    ["Polyhedron", props.isPolyhedron ? "Yes" : "No"],
  ];

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div>
        <p className="text-sm font-semibold">Properties of Solids</p>
        <p className="text-[11px] text-muted-foreground">Generated from the selected solid.</p>
      </div>

      <div className="divide-y divide-foreground/10 rounded-md border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-[11px] text-muted-foreground">{k}</span>
            <span className="text-xs font-medium">{v}</span>
          </div>
        ))}
      </div>

      <Separator />

      <div className="rounded-md border border-border p-2.5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Euler&rsquo;s formula</p>
        {props.eulerHolds === null ? (
          <p className="mt-1 text-xs text-muted-foreground">
            F + V &minus; E = 2 applies to polyhedra only, so it is not used for this solid.
          </p>
        ) : (
          <p className="mt-1 text-xs">
            F + V &minus; E = {props.faces} + {props.vertices} &minus; {props.edges} ={" "}
            <span className="font-semibold">{props.faces + props.vertices - props.edges}</span>
            {props.eulerHolds ? " ✓" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

export default PropertiesPanel;
