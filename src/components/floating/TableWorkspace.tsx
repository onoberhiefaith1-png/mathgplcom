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

interface Props {
  grid: TableGrid;
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
          {grid.label} workspace
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

      {/* Grid */}
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
                    {h || `C${c + 1}`}
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
                  const isRetained = retainedSet.has(k);
                  const inLine = activeSet.has(k);
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
                      {v || <span className="text-foreground/25">·</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-foreground/55 italic">{hint}</p>
      </div>

      {/* Lines generated by this table */}
      {children && <div className="px-3 pb-3 space-y-1">{children}</div>}
    </div>
  );
};

export default TableWorkspace;
