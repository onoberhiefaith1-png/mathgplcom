// Table Floating-Number Workspace — the live grid a highlighted table
// becomes on the Generated Floating Numbers page.
//
// Three independent controls:
//   • Orientation — Row vs Column (governs generation AND manual clicks)
//   • Generate    — rebuild every automatic line from the grid
//   • Retention   — teacher marks cells that stay visible (read-only) for
//                   students; every other cell is blank on the Smartboard.

import { Plus, RefreshCw, Lock, Rows3, Columns3 } from "lucide-react";
import type { TableGrid, TableOrientation } from "@/lib/floating/tableGrid";
import { cellKey } from "@/lib/floating/tableGrid";
import { StructureStage, canRenderStructure } from "@/components/structures/StructureStage";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { SolutionObjectView } from "@/components/lessonnotes/SolutionObjectView";


interface Props {
  grid: TableGrid;
  /** The ONE floating number this whole table occupies in the lesson. */
  stepNo?: number;
  orientation: TableOrientation;
  retained: string[];
  retentionMode: boolean;
  /** Cells owned by the line currently being assembled (manual mode). */
  activeCells: string[];
  manualActive: boolean;
  lineCount: number;
  onOrientationChange: (o: TableOrientation) => void;
  onGenerate: () => void;
  onToggleRetention: () => void;
  onAddLine: () => void;
  onCellClick: (key: string) => void;
  children?: React.ReactNode;
}

const TableWorkspace = ({
  grid,
  stepNo,
  orientation,
  retained,
  retentionMode,
  activeCells,
  manualActive,
  lineCount,
  onOrientationChange,
  onGenerate,
  onToggleRetention,
  onAddLine,
  onCellClick,
  children,
}: Props) => {
  const retainedSet = new Set(retained);
  const activeSet = new Set(activeCells);
  // Smart Structure: cells that are pure structure (bracket gutter, minus
  // column, divider) are retained by definition and never generate lines.
  const staticSet = new Set(grid.staticCells ?? []);


  const hint = retentionMode
    ? "Retention: click cells students should still see. Everything else is blank on the Smartboard."
    : manualActive
      ? `Click cells to add them to the new line — same ${orientation === "row" ? "row" : "column"} only.`
      : "Choose an orientation, then Generate, or use “+ Add Line” to build lines by clicking cells.";

  return (
    <div
      className="rounded-md my-4"
      style={{
        border: "1px solid hsl(220 15% 60% / 0.35)",
        background: "hsl(38 38% 97%)",
      }}
    >
      {/* Control strip */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "hsl(220 15% 60% / 0.25)" }}>
        <span className="text-[10px] uppercase tracking-[0.3em] text-foreground/55">
          {stepNo ? `Line ${stepNo} · ` : ""}{grid.label} workspace
        </span>

        <div className="inline-flex rounded-md overflow-hidden border border-foreground/20 ml-1">
          <button
            onClick={() => onOrientationChange("row")}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1"
            style={orientation === "row"
              ? { background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }
              : { color: "hsl(220 35% 18%)" }}
          >
            <Rows3 className="h-3 w-3" /> Row
          </button>
          <button
            onClick={() => onOrientationChange("column")}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1"
            style={orientation === "column"
              ? { background: "hsl(220 35% 18%)", color: "hsl(38 38% 96%)" }
              : { color: "hsl(220 35% 18%)" }}
          >
            <Columns3 className="h-3 w-3" /> Column
          </button>
        </div>

        <button
          onClick={onGenerate}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-foreground/20 hover:bg-foreground/5"
          style={{ color: "hsl(220 35% 18%)" }}
          title="Rebuild every automatic line from the table"
        >
          <RefreshCw className="h-3 w-3" /> Generate
        </button>

        <button
          onClick={onAddLine}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-foreground/20 hover:bg-foreground/5"
          style={manualActive
            ? { background: "hsl(48 95% 88%)", color: "hsl(220 35% 18%)" }
            : { color: "hsl(220 35% 18%)" }}
        >
          <Plus className="h-3 w-3" /> Add Line
        </button>

        <button
          onClick={onToggleRetention}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-foreground/20 hover:bg-foreground/5"
          style={retentionMode
            ? { background: "hsl(150 45% 82%)", color: "hsl(150 40% 18%)" }
            : { color: "hsl(220 35% 18%)" }}
          title="Mark cells students keep seeing"
        >
          <Lock className="h-3 w-3" /> Retention
        </button>

        <span className="ml-auto text-[11px] text-foreground/55 tabular-nums">
          {lineCount} line{lineCount === 1 ? "" : "s"}
        </span>
      </div>

      {/* NON-TABLE OBJECT (diagram, graph, 3D scene, animation, image). It has
          no editable cells: it travels as ONE placeable lesson object. */}
      {grid.object ? (
        <div className="px-3 py-3 overflow-x-auto">
          <div className="rounded-md bg-[hsl(38_30%_96%)] p-3 inline-block max-w-full">
            <SolutionObjectView nodeType={grid.object.nodeType} attrs={grid.object.attrs} />
          </div>
          <p className="mt-2 text-[11px] text-foreground/55 italic">
            Diagram object — press Generate to create the line that places it on the Smartboard.
          </p>
        </div>
      ) : (
      <>
      {/* Smart Structure — the teacher's own layout, preserved exactly. The
          static layer (bracket, rules, divider, alignment) is drawn by the
          asset itself; only the editable cells are pickable, as chips. */}
      {grid.structureId && canRenderStructure(grid.structureId) ? (
        <div className="px-3 py-3 overflow-x-auto">
          <div className="rounded-md bg-[hsl(38_30%_96%)] p-3">
            <StructureStage
              structureId={grid.structureId}
              structureAttrs={grid.structureAttrs ?? {}}
              cells={grid.cells}
            />
          </div>
          <div className="mt-3 space-y-1.5">
            {grid.cells.map((row, r) => {
              const pick = row
                .map((v, c) => ({ v, c, k: cellKey(r, c) }))
                .filter((cell) => !staticSet.has(cell.k));
              if (!pick.length) return null;
              return (
                <div key={`sr-${r}`} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-14 shrink-0 text-[11px] text-foreground/50 tabular-nums">
                    Row {r + 1}
                  </span>
                  {pick.map(({ v, k }) => (
                    <button
                      key={k}
                      onClick={() => onCellClick(k)}
                      className="rounded px-2 py-0.5 text-[13px] tabular-nums transition-colors"
                      style={{
                        border: activeSet.has(k)
                          ? "2px solid hsl(40 85% 45%)"
                          : "1px solid hsl(220 15% 40% / 0.45)",
                        background: retainedSet.has(k) ? "hsl(150 45% 88%)" : "transparent",
                        color: "hsl(220 35% 18%)",
                      }}
                      title={retainedSet.has(k) ? "Retained — visible to students" : k}
                    >
                      {v ? renderMathInline(v, `tws-${grid.objId}-${k}`) : "·"}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-foreground/55 italic">{hint}</p>
        </div>
      ) : (
      /* Grid */
      <div className="px-3 py-3 overflow-x-auto">
        <table className="border-collapse text-[14px]" style={{ color: "hsl(220 35% 18%)" }}>
          {grid.headers.some((h) => h.trim()) && (
            <thead>
              <tr>
                {grid.headers.map((h, c) => (
                  <th
                    key={`h-${c}`}
                    className="px-3 py-1.5 font-semibold text-center"
                    style={{ border: "1px solid hsl(220 15% 40% / 0.5)", background: "hsl(38 30% 92%)" }}
                  >
                    {h ? renderMathInline(h, `twh-${grid.objId}-${c}`) : `C${c + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {grid.cells.map((row, r) => (
              <tr key={`r-${r}`}>
                {row.map((v, c) => {
                  const k = cellKey(r, c);
                  const structural = staticSet.has(k);
                  const isRetained = retainedSet.has(k);
                  const inLine = activeSet.has(k);
                  if (structural) {
                    // Static structure — the teacher's drawing. Never a
                    // Floating Number, never clickable.
                    return (
                      <td
                        key={k}
                        className="px-3 py-1.5 text-center select-none"
                        style={{
                          border: "1px dashed hsl(220 15% 40% / 0.3)",
                          background: "hsl(220 12% 90%)",
                          color: "hsl(220 20% 35%)",
                          minWidth: 56,
                        }}
                        title="Retained structure — never a Floating Number"
                      >
                        {grid.staticGlyphs?.[k] || <span className="text-foreground/25">▨</span>}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={k}
                      onClick={() => onCellClick(k)}
                      className="px-3 py-1.5 text-center cursor-pointer select-none tabular-nums hover:bg-foreground/5"
                      style={{
                        border: inLine
                          ? "2px solid hsl(40 85% 45%)"
                          : "1px solid hsl(220 15% 40% / 0.5)",
                        background: isRetained ? "hsl(150 45% 88%)" : undefined,
                        minWidth: 56,
                      }}
                      title={isRetained ? "Retained — visible to students" : k}
                    >
                      {v ? renderMathInline(v, `twc-${grid.objId}-${k}`) : <span className="text-foreground/25">·</span>}
                    </td>
                  );
                })}

              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-foreground/55 italic">{hint}</p>
      </div>
      )}
      </>
      )}


      {/* Lines generated by this table */}
      {children && <div className="px-3 pb-3 space-y-1">{children}</div>}
    </div>
  );
};

export default TableWorkspace;
