// NodeView for a Mathematical Table clipping.
//
// Renders the generated table block in textbook style — monospace,
// fixed column widths, horizontal scroll when it overflows. Every cell
// is contentEditable so the teacher can override any value; overrides
// live in `attrs.edits` so regenerate never wipes teacher work without
// asking. The top bar lets the teacher change the input value, see the
// valid range, regenerate, or delete.

import { useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findTable, type GeneratedTable } from "@/lib/tables/catalog";
import { cn } from "@/lib/utils";

const cellKey = (rowIdx: number, kind: "main" | "diff" | "label", colIdx: number) =>
  `${rowIdx}:${kind}:${colIdx}`;

export function MathTableView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const tableId = node.attrs.tableId as string;
  const tableName = node.attrs.tableName as string;
  const initialInput = Number(node.attrs.input) || 0;
  const generated = node.attrs.generated as GeneratedTable | null;
  const edits = (node.attrs.edits as Record<string, string>) || {};

  const entry = useMemo(() => findTable(tableId), [tableId]);
  const [inputStr, setInputStr] = useState(String(initialInput));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInputStr(String(initialInput));
  }, [initialInput]);

  const regenerate = () => {
    if (!entry) return;
    const v = Number(inputStr);
    if (!Number.isFinite(v)) {
      setError("Enter a numeric value.");
      return;
    }
    const valErr = entry.validate(v);
    if (valErr) { setError(valErr); return; }
    setError(null);
    const next = entry.generate(v);
    updateAttributes({ input: v, generated: next, edits: {} });
  };

  // Render a single editable cell. Highlights the lookup target.
  const Cell = ({
    rowIdx, kind, colIdx, text, highlight,
  }: { rowIdx: number; kind: "main" | "diff" | "label"; colIdx: number; text: string; highlight?: boolean }) => {
    const key = cellKey(rowIdx, kind, colIdx);
    const ref = useRef<HTMLDivElement>(null);
    const display = key in edits ? edits[key] : text;
    return (
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={(e) => {
          const v = e.currentTarget.textContent ?? "";
          if (v === text) {
            const next = { ...edits }; delete next[key];
            updateAttributes({ edits: next });
          } else {
            updateAttributes({ edits: { ...edits, [key]: v } });
          }
        }}
        className={cn(
          "px-2 py-1 min-w-[3.5rem] text-center border-r border-b border-neutral-200 outline-hidden focus:bg-yellow-50 cursor-text",
          highlight && "bg-yellow-100 font-semibold",
          kind === "label" && "font-semibold bg-neutral-100",
        )}
      >
        {display}
      </div>
    );
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "my-4 rounded-md border bg-white text-black",
        selected ? "border-yellow-400 shadow" : "border-neutral-200",
      )}
      data-drag-handle
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-neutral-200 bg-neutral-50">
        <div className="text-[12px] font-semibold">{tableName || "Mathematical Table"}</div>
        <div className="text-[11px] text-neutral-500">
          Range: {entry?.rangeLabel ?? "—"}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Input
            value={inputStr}
            onChange={(e) => setInputStr(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") regenerate(); }}
            className="h-7 w-28 text-[12px]"
            placeholder="value"
          />
          <Button size="sm" variant="outline" onClick={regenerate} className="h-7 text-[11px]">
            <RefreshCw className="h-3 w-3 mr-1" /> Generate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteNode()} className="h-7 text-[11px] text-red-600 hover:text-red-700">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 text-[11px] text-red-700 bg-red-50 border-b border-red-100 flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      )}

      {/* Table body (horizontal scroll) */}
      {generated ? (
        <div className="overflow-x-auto" data-no-drag>
          <div className="inline-block min-w-full font-mono text-[12px] text-black">
            {/* Header row */}
            <div className="flex border-b-2 border-neutral-300">
              <div className="px-2 py-1 min-w-[3.5rem] font-semibold border-r border-neutral-300 bg-neutral-100 text-center">
                {generated.rowLabelHeader}
              </div>
              {generated.mainHeadings.map((h, i) => (
                <div key={`mh${i}`} className="px-2 py-1 min-w-[3.5rem] font-semibold border-r border-neutral-200 bg-neutral-100 text-center">{h}</div>
              ))}
              {generated.diffHeadings.length > 0 && (
                <>
                  <div className="px-2 py-1 min-w-[1.5rem] font-semibold border-l-2 border-r border-neutral-300 bg-neutral-100 text-center">‖</div>
                  {generated.diffHeadings.map((h, i) => (
                    <div key={`dh${i}`} className="px-2 py-1 min-w-[2.5rem] font-semibold border-r border-neutral-200 bg-neutral-100 text-center text-neutral-700">{h}</div>
                  ))}
                </>
              )}
            </div>
            {/* Data rows */}
            {generated.rows.map((r, rIdx) => (
              <div key={`r${rIdx}`} className="flex">
                <Cell rowIdx={rIdx} kind="label" colIdx={0} text={r.label} />
                {r.main.map((c, cIdx) => (
                  <Cell key={`m${cIdx}`} rowIdx={rIdx} kind="main" colIdx={cIdx} text={c.text} highlight={c.highlight} />
                ))}
                {r.diff && r.diff.length > 0 && (
                  <>
                    <div className="px-2 py-1 min-w-[1.5rem] border-l-2 border-r border-neutral-300 bg-neutral-100 text-center text-neutral-400">‖</div>
                    {r.diff.map((c, cIdx) => (
                      <Cell key={`d${cIdx}`} rowIdx={rIdx} kind="diff" colIdx={cIdx} text={c.text} highlight={c.highlight} />
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="px-3 py-1.5 text-[11px] text-neutral-500 border-t border-neutral-200">
            {generated.lookupNote}
          </div>
        </div>
      ) : (
        <div className="px-3 py-4 text-[12px] text-neutral-500">
          Enter a value above and press <strong>Generate</strong> to look up this table.
        </div>
      )}
    </NodeViewWrapper>
  );
}
