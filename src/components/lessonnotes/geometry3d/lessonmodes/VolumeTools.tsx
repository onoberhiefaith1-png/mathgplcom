// Lesson Mode: Volume — editable dimensions, live formula, full working,
// teaching notes and an exam-style worked example.

import { useState } from "react";
import { Cuboid } from "lucide-react";
import { shapeMath, type Dimension } from "@/lib/geometry3d/formulaLibrary";
import { workedExample, workedExampleText } from "@/lib/geometry3d/workedExample";
import type { Solid3D } from "@/lib/geometry3d/scene3d";
import {
  PanelSection, UnitControls, DimensionEditor, WorkingBlock, VariableTable,
  TeachingNotes, CopyButton,
} from "./TeachingPanelKit";

interface Props {
  solid: Solid3D | null;
  unit: string;
  setUnit: (u: string) => void;
  decimals: number;
  setDecimals: (n: number) => void;
  onParam: (key: string, rawValue: number) => void;
  onGuide?: (guide: string | null) => void;
}

export function VolumeTools({ solid, unit, setUnit, decimals, setDecimals, onParam, onGuide }: Props) {
  const [showExample, setShowExample] = useState(false);

  if (!solid) {
    return (
      <div className="h-full overflow-y-auto border-l border-foreground/10 bg-background p-4">
        <p className="text-xs text-muted-foreground">Select a solid to see its volume formula.</p>
      </div>
    );
  }

  const m = shapeMath(solid);
  const example = workedExample(solid, "volume", unit, decimals);
  const setDim = (key: string, value: number) => {
    const d = m.dimensions.find((x) => x.key === key) as Dimension | undefined;
    onParam(key, d ? value / (d.scaleFactor || 1) : value);
  };

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div className="flex items-center gap-1.5">
        <Cuboid className="h-4 w-4" />
        <p className="text-sm font-semibold">Volume · {m.name}</p>
      </div>

      <PanelSection title="Dimensions (editable)">
        <DimensionEditor
          dimensions={m.dimensions}
          unit={unit}
          decimals={decimals}
          onChange={setDim}
          onHover={(g) => onGuide?.(g)}
        />
      </PanelSection>

      <PanelSection title="Mathematical working">
        <WorkingBlock working={m.volume} unit={unit} decimals={decimals} />
      </PanelSection>

      <PanelSection title="What each letter means" defaultOpen={false}>
        <VariableTable variables={m.variables} unit={unit} decimals={decimals} />
      </PanelSection>

      <PanelSection title="Teaching information" defaultOpen={false}>
        <TeachingNotes why={m.why.volume} how={m.how.volume} notes={m.notes} mistakes={m.mistakes} />
      </PanelSection>

      <PanelSection title="Units & precision" defaultOpen={false}>
        <UnitControls unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals} />
      </PanelSection>

      {example && (
        <div className="rounded-md border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Worked example</p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setShowExample((v) => !v)}
                className="rounded border border-border px-2 py-1 text-[10px] hover:bg-muted"
              >{showExample ? "Hide" : "Generate"}</button>
              {showExample && <CopyButton text={workedExampleText(example)} />}
            </div>
          </div>
          {showExample && (
            <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed">
              <p className="font-medium">{example.question}</p>
              <ol className="space-y-0.5">
                {example.steps.map((s, i) => (
                  <li key={i} className="font-mono text-[10.5px] text-muted-foreground">{s.label}: {s.line}</li>
                ))}
              </ol>
              <p className="font-semibold text-primary">{example.answer}</p>
              <p className="text-[10px] text-muted-foreground">[{example.marks} marks]</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default VolumeTools;
