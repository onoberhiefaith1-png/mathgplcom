// BoardToolLayer — renders every Smartboard tool object (2D geometry, 3D/TVD,
// Smart Graph, Mathematical Table) as an independent floating workspace that
// sits above the board.
//
// There is deliberately no second engine here: 2D uses GeometryDiagram, 3D uses
// Scene3DCanvas, the graph uses the Lesson Note SmartGraphView and the table the
// Lesson Note MathTableView, all reached through NodeAttrsAdapter. The board's
// own writing/text surface is never touched.

import { useState } from "react";
import { Axis3d, Boxes, LineChart, Shapes, Table as TableIcon } from "lucide-react";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { Scene3DCanvas } from "@/components/lessonnotes/geometry3d/Scene3DCanvas";
import { SmartGraphView } from "@/components/lessonnotes/math-tools/SmartGraphView";
import { MathTableView } from "@/components/lessonnotes/math-tools/MathTableView";
import { DEFAULT_SETTINGS as DEFAULT_SETTINGS_3D } from "@/lib/geometry3d/scene3d";
import type { BoardDiagram } from "@/lib/smartboard/boardDiagrams";
import { nodeViewPropsFor } from "./NodeAttrsAdapter";
import { FloatingToolLayer, type FloatingToolPalette } from "./FloatingToolLayer";
import type { SmartGraphAttrs } from "@/lib/graph/graphModel";
import type { MathTableAttrs } from "@/components/lessonnotes/extensions/MathTable";

interface Props {
  diagrams: BoardDiagram[];
  /** Move / resize / attribute commit — one entry in the shared board history. */
  onChange: (next: BoardDiagram[]) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  activeId: string | null;
  onActivate: (id: string) => void;
  editable: boolean;
  palette: FloatingToolPalette;
}

const TITLES: Record<BoardDiagram["kind"], string> = {
  "2d": "Geometry",
  "3d": "3D / TVD",
  graph: "Graph",
  table: "Table",
};

export const BoardToolLayer = ({
  diagrams, onChange, onEdit, onDelete, activeId, onActivate, editable, palette,
}: Props) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const patch = (id: string, p: Partial<BoardDiagram>) =>
    onChange(diagrams.map((d) => (d.id === id ? ({ ...d, ...p } as BoardDiagram) : d)));

  if (diagrams.length === 0) return null;

  return (
    <div
      data-sb-diagram-layer=""
      className="absolute inset-0"
      style={{ pointerEvents: "none", zIndex: 26 }}
    >
      {diagrams.map((d) => {
        const icon =
          d.kind === "2d" ? <Shapes className="h-3 w-3" /> :
          d.kind === "3d" ? <Boxes className="h-3 w-3" /> :
          d.kind === "graph" ? <LineChart className="h-3 w-3" /> :
          <TableIcon className="h-3 w-3" />;

        return (
          <FloatingToolLayer
            key={d.id}
            title={TITLES[d.kind]}
            icon={icon}
            x={d.x}
            y={d.y}
            width={d.width}
            height={d.height}
            active={activeId === d.id}
            collapsed={!!collapsed[d.id]}
            editable={editable}
            palette={palette}
            solidBody={d.kind === "graph" || d.kind === "table" || d.kind === "2d"}
            actions={d.kind === "3d" && editable ? (
              <button
                type="button"
                title="Show / hide the 3D coordinate axes"
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-black/10"
                onClick={(e) => {
                  e.stopPropagation();
                  const s = d.scene.settings ?? DEFAULT_SETTINGS_3D;
                  const on = !(s.showAxisX || s.showAxisY || s.showAxisZ);
                  patch(d.id, {
                    scene: {
                      ...d.scene,
                      settings: {
                        ...s,
                        showAxisX: on, showAxisY: on, showAxisZ: on, axisLabels: on,
                      },
                    },
                  } as Partial<BoardDiagram>);
                }}
              >
                <Axis3d className="h-3 w-3" /> Axes
              </button>
            ) : undefined}
            onGeometry={(g) => patch(d.id, g as Partial<BoardDiagram>)}
            onActivate={() => onActivate(d.id)}
            onToggleCollapse={() => setCollapsed((p) => ({ ...p, [d.id]: !p[d.id] }))}
            onEdit={d.kind === "2d" || d.kind === "3d" ? () => onEdit(d.id) : undefined}
            onDelete={() => onDelete(d.id)}
          >
            <ToolBody
              diagram={d}
              onAttrs={(attrs) => patch(d.id, { attrs } as Partial<BoardDiagram>)}
              onDelete={() => onDelete(d.id)}
              selected={activeId === d.id}
            />
          </FloatingToolLayer>
        );
      })}
    </div>
  );
};

function ToolBody({
  diagram, onAttrs, onDelete, selected,
}: {
  diagram: BoardDiagram;
  onAttrs: (attrs: Record<string, unknown>) => void;
  onDelete: () => void;
  selected: boolean;
}) {
  const [live3d, setLive3d] = useState(false);

  if (diagram.kind === "2d") {
    return (
      <div className="grid h-full w-full place-items-center p-2">
        <GeometryDiagram
          scene={diagram.scene}
          explicitWidth={diagram.width - 16}
          explicitHeight={diagram.height - 44}
        />
      </div>
    );
  }

  if (diagram.kind === "graph") {
    const attrs = diagram.attrs as unknown as Record<string, unknown>;
    return (
      <div className="h-full w-full overflow-auto p-1">
        <SmartGraphView
          {...nodeViewPropsFor({
            attrs,
            onChange: (patch) => onAttrs({ ...attrs, ...(patch as Record<string, unknown>) } as Partial<SmartGraphAttrs> as Record<string, unknown>),
            onDelete,
            selected,
          })}
        />
      </div>
    );
  }

  if (diagram.kind === "table") {
    const attrs = diagram.attrs as unknown as Record<string, unknown>;
    return (
      <div className="h-full w-full overflow-auto p-1">
        <MathTableView
          {...nodeViewPropsFor({
            attrs,
            onChange: (patch) => onAttrs({ ...attrs, ...(patch as Record<string, unknown>) } as Partial<MathTableAttrs> as Record<string, unknown>),
            onDelete,
            selected,
          })}
        />
      </div>
    );
  }

  if (live3d) {
    return <Scene3DCanvas scene={diagram.scene} frameloop="always" className="h-full w-full" />;
  }

  return (
    <button
      type="button"
      onClick={() => setLive3d(true)}
      className="flex h-full w-full flex-col items-center justify-center gap-2 opacity-70 transition hover:opacity-100"
      aria-label="Activate 3D scene"
    >
      <Boxes className="h-7 w-7" />
      <span className="text-xs font-medium">
        {diagram.scene.objects.length} object{diagram.scene.objects.length === 1 ? "" : "s"} · tap to explore in 3D
      </span>
    </button>
  );
}

export default BoardToolLayer;
