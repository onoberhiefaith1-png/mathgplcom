// SmartChart dispatcher — reads the `kind` and mounts the matching chart
// component. Bar and Histogram share the same mathematical renderer,
// differing only in bar spacing. Other kinds render a placeholder.

import { useMemo } from "react";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import { PanelGroup, PanelRow } from "@/components/lessonnotes/panel/panelPrimitives";
import { normalizeChart, type ChartKind } from "./types";
import { BarChart } from "./BarChart";

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

export function SmartChart({ attrs, onChange, selected = false }: Props) {
  const model = useMemo(() => normalizeChart(attrs), [attrs]);

  const patch = (p: Partial<typeof model>) =>
    onChange({ ...model, ...p } as Record<string, unknown>);

  if (model.kind === "bar" || model.kind === "histogram") {
    return <BarChart attrs={model} onChange={patch} selected={selected} />;
  }

  return <PlaceholderChart kind={model.kind} onSwitch={(k) => patch({ kind: k } as any)} selected={selected} />;
}

function PlaceholderChart({
  kind, onSwitch, selected,
}: { kind: ChartKind; onSwitch: (k: ChartKind) => void; selected: boolean }) {
  const editor = (
    <div>
      <PanelGroup label="Chart type">
        <PanelRow label="Kind">
          <select
            value={kind}
            onChange={(e) => onSwitch(e.target.value as ChartKind)}
            className="rounded border border-foreground/20 bg-background px-1 py-0.5 text-xs text-foreground"
          >
            <option value="bar">Bar chart</option>
            <option value="pie">Pie chart</option>
            <option value="histogram">Histogram</option>
            <option value="scatter">Scatter plot</option>
            <option value="line">Line graph</option>
            <option value="dotplot">Dot plot</option>
            <option value="boxplot">Box &amp; whisker</option>
            <option value="ogive">Cumulative frequency</option>
          </select>
        </PanelRow>
      </PanelGroup>
      <div className="px-2 py-1 text-xs text-muted-foreground">
        This chart kind is being upgraded to the interactive Smart Chart in an upcoming
        release. Switch to "Bar chart" or "Histogram" to try the new editor today.
      </div>
    </div>
  );
  useRegisterAssetEditor(!!selected, "smartChart-placeholder", `${labelFor(kind)}`, editor);

  return (
    <div
      className="inline-flex items-center justify-center rounded-md border border-dashed border-foreground/30 bg-foreground/[0.02] text-[13px] text-foreground/70"
      style={{ width: 320, height: 180, padding: 12 }}
    >
      {labelFor(kind)} — coming next phase
    </div>
  );
}

function labelFor(k: ChartKind): string {
  return {
    bar: "Bar chart",
    pie: "Pie chart",
    histogram: "Histogram",
    scatter: "Scatter plot",
    line: "Line graph",
    dotplot: "Dot plot",
    boxplot: "Box & whisker",
    ogive: "Cumulative frequency",
  }[k];
}
