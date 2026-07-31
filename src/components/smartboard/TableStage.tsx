// Table Stage — the read-only table that accompanies a table-derived
// Floating Number line on the Smartboard.
//
// Retained cells (chosen by the teacher on the Floating Numbers page) stay
// visible; every other cell is blank so students supply the value. The cells
// belonging to the ACTIVE line are outlined.

import { useState } from "react";
import { ChevronDown, ChevronUp, Table2 } from "lucide-react";
import type { FloatingTableRef } from "@/lib/lessonnotes/floatingCompile";

interface Props {
  table: FloatingTableRef;
  dark?: boolean;
}

const key = (r: number, c: number) => `${r}:${c}`;

const TableStage = ({ table, dark }: Props) => {
  const [open, setOpen] = useState(true);
  const grid = table.grid;
  if (!grid) return null;

  const retained = new Set(table.retained ?? []);
  const active = new Set(table.cellKeys ?? []);
  const ink = dark ? "rgba(245,245,240,0.92)" : "#1a2230";
  const border = dark ? "rgba(245,245,240,0.4)" : "rgba(26,34,48,0.45)";

  return (
    <div
      className="absolute z-30 rounded-lg overflow-hidden"
      style={{
        right: 16,
        top: 96,
        maxWidth: "38%",
        background: dark ? "rgba(20,24,32,0.88)" : "rgba(255,253,247,0.94)",
        border: `1px solid ${border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        backdropFilter: "blur(6px)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ color: ink }}
      >
        <Table2 className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-[0.25em] flex-1 truncate">
          {grid.label}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="px-3 pb-3 overflow-auto" style={{ maxHeight: "48vh" }}>
          <table className="border-collapse text-[15px]" style={{ color: ink }}>
            {grid.headers.some((h) => String(h).trim()) && (
              <thead>
                <tr>
                  {grid.headers.map((h, c) => (
                    <th
                      key={`h-${c}`}
                      className="px-3 py-1.5 text-center font-semibold"
                      style={{ border: `1px solid ${border}` }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {grid.cells.map((row, r) => (
                <tr key={`r-${r}`}>
                  {row.map((v, c) => {
                    const k = key(r, c);
                    const show = retained.has(k);
                    return (
                      <td
                        key={k}
                        className="px-3 py-1.5 text-center tabular-nums"
                        style={{
                          border: active.has(k)
                            ? "2px solid hsl(40 85% 55%)"
                            : `1px solid ${border}`,
                          minWidth: 54,
                          minHeight: "1.6em",
                        }}
                      >
                        {show ? v : "\u00A0"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TableStage;
