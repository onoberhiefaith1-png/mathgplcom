// Place-Value Chart — Units-locked, expandable left. Columns can only be
// added or removed from the LEFT; the Units column cannot be removed.
// No visible vertical grid lines; invisible alignment guides keep every
// digit centred beneath its heading. Editing lives in the right-hand
// Properties Panel — no floating chip toolbars.

import { useCallback, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import { SmartCell } from "../smarttable/SmartCell";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import {
  PanelGroup, PanelRow, PanelButton, PanelNumber, PanelColor, PanelToggle,
} from "@/components/lessonnotes/panel/panelPrimitives";

interface Attrs {
  wholeHeaders?: string[];
  decimalHeaders?: string[];
  values?: string[];
  decValues?: string[];
  fontSize?: number;
  headingSize?: number;
  colWidth?: number;
  rowHeight?: number;
  showGuides?: boolean;
  headingColor?: string;
  digitColor?: string;
}

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

// Left-to-right column names as columns are added.
const LEFT_EXPANSION = ["T", "H", "Th", "TTh", "HTh", "M", "TM", "HM", "B"];

function normalize(a: Record<string, unknown>): Required<Attrs> {
  const wholeHeaders = Array.isArray(a.wholeHeaders) && a.wholeHeaders.length
    ? (a.wholeHeaders as string[])
    : ["HTh", "TTh", "Th", "H", "T", "U"];
  // Ensure the rightmost header is Units and can never be removed.
  if (wholeHeaders[wholeHeaders.length - 1] !== "U") {
    wholeHeaders.push("U");
  }
  const decimalHeaders = Array.isArray(a.decimalHeaders) ? (a.decimalHeaders as string[]) : [];
  const values = Array.isArray(a.values) ? (a.values as string[]) : [];
  const decValues = Array.isArray(a.decValues) ? (a.decValues as string[]) : [];
  while (values.length < wholeHeaders.length) values.push("");
  values.length = wholeHeaders.length;
  while (decValues.length < decimalHeaders.length) decValues.push("");
  decValues.length = decimalHeaders.length;
  return {
    wholeHeaders,
    decimalHeaders,
    values,
    decValues,
    fontSize: Number(a.fontSize) || 18,
    headingSize: Number(a.headingSize) || 11,
    colWidth: Number(a.colWidth) || 44,
    rowHeight: Number(a.rowHeight) || 40,
    showGuides: a.showGuides === undefined ? false : Boolean(a.showGuides),
    headingColor: typeof a.headingColor === "string" ? a.headingColor : "#64748b",
    digitColor: typeof a.digitColor === "string" ? a.digitColor : "#0f172a",
  };
}

export function PlaceValueChart({ attrs, onChange, selected }: Props) {
  const m = useMemo(() => normalize(attrs), [attrs]);
  const patch = useCallback((p: Partial<Attrs>) => onChange({ ...p }), [onChange]);

  const setValue = (i: number, v: string) => {
    const a = [...m.values]; a[i] = v; patch({ values: a });
  };
  const setDecValue = (i: number, v: string) => {
    const a = [...m.decValues]; a[i] = v; patch({ decValues: a });
  };

  // Add a place value on the LEFT. Choose the next unused expansion name
  // that isn't already present.
  const addLeft = () => {
    const used = new Set(m.wholeHeaders);
    const next = LEFT_EXPANSION.find((h) => !used.has(h)) ?? "?";
    patch({
      wholeHeaders: [next, ...m.wholeHeaders],
      values: ["", ...m.values],
    });
  };
  // Remove the LEFTMOST column, but never remove U.
  const removeLeft = () => {
    if (m.wholeHeaders.length <= 1) return;
    patch({
      wholeHeaders: m.wholeHeaders.slice(1),
      values: m.values.slice(1),
    });
  };
  const addDecCol = () => patch({
    decimalHeaders: [...m.decimalHeaders, ["t", "h", "th", "tth"][m.decimalHeaders.length] ?? ""],
    decValues: [...m.decValues, ""],
  });
  const removeDecCol = () => m.decimalHeaders.length > 0 && patch({
    decimalHeaders: m.decimalHeaders.slice(0, -1),
    decValues: m.decValues.slice(0, -1),
  });

  const cellStyle: React.CSSProperties = {
    width: m.colWidth,
    height: m.rowHeight,
    minWidth: m.colWidth,
    textAlign: "center",
    verticalAlign: "middle",
    padding: 0,
    borderLeft: m.showGuides ? "1px dashed hsl(var(--foreground) / 0.15)" : undefined,
  };
  const headStyle: React.CSSProperties = {
    ...cellStyle,
    fontSize: m.headingSize,
    color: m.headingColor,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderBottom: "2px solid hsl(var(--foreground) / 0.85)",
  };
  const digitStyle: React.CSSProperties = {
    ...cellStyle,
    fontSize: m.fontSize,
    color: m.digitColor,
    fontWeight: 500,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  };

  const editor = (
    <div>
      <PanelGroup label="Columns">
        <PanelButton full onClick={addLeft}><Plus className="h-3 w-3" /> Add place value (left)</PanelButton>
        <PanelButton full onClick={removeLeft}
          variant={m.wholeHeaders.length <= 1 ? "default" : "default"}>
          <Minus className="h-3 w-3" /> Remove left column
        </PanelButton>
        <PanelRow label="Decimal columns">
          <PanelButton onClick={removeDecCol}><Minus className="h-3 w-3" /></PanelButton>
          <span className="tabular-nums w-4 text-center">{m.decimalHeaders.length}</span>
          <PanelButton onClick={addDecCol}><Plus className="h-3 w-3" /></PanelButton>
        </PanelRow>
      </PanelGroup>

      <PanelGroup label="Sizing">
        <PanelRow label="Font size"><PanelNumber value={m.fontSize} min={10} max={48} onChange={(v) => patch({ fontSize: v })} /></PanelRow>
        <PanelRow label="Heading size"><PanelNumber value={m.headingSize} min={8} max={24} onChange={(v) => patch({ headingSize: v })} /></PanelRow>
        <PanelRow label="Column width"><PanelNumber value={m.colWidth} min={24} max={120} onChange={(v) => patch({ colWidth: v })} /></PanelRow>
        <PanelRow label="Row height"><PanelNumber value={m.rowHeight} min={24} max={96} onChange={(v) => patch({ rowHeight: v })} /></PanelRow>
      </PanelGroup>

      <PanelGroup label="Appearance">
        <PanelRow label="Show alignment guides"><PanelToggle value={m.showGuides} onChange={(v) => patch({ showGuides: v })} /></PanelRow>
        <PanelRow label="Heading colour"><PanelColor value={m.headingColor} onChange={(v) => patch({ headingColor: v })} /></PanelRow>
        <PanelRow label="Digit colour"><PanelColor value={m.digitColor} onChange={(v) => patch({ digitColor: v })} /></PanelRow>
      </PanelGroup>
    </div>
  );
  useRegisterAssetEditor(!!selected, "placeValueChart", "Place-value chart", editor);

  return (
    <div className="not-prose inline-block">
      <table className="border-collapse text-foreground" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {m.wholeHeaders.map((h, i) => (
              <th key={"wh" + i} style={headStyle}>{h}</th>
            ))}
            {m.decimalHeaders.length > 0 && (
              <th style={{ ...headStyle, width: 14, minWidth: 14, borderBottom: "none" }}> </th>
            )}
            {m.decimalHeaders.map((h, i) => (
              <th key={"dh" + i} style={headStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {m.values.map((v, i) => (
              <td key={"wv" + i} style={digitStyle}>
                <SmartCell value={v} onChange={(nv) => setValue(i, nv)} align="center" />
              </td>
            ))}
            {m.decimalHeaders.length > 0 && (
              <td style={{ ...digitStyle, width: 14, minWidth: 14, fontWeight: 900 }}>.</td>
            )}
            {m.decValues.map((v, i) => (
              <td key={"dv" + i} style={digitStyle}>
                <SmartCell value={v} onChange={(nv) => setDecValue(i, nv)} align="center" />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default PlaceValueChart;
