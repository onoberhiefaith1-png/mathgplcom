// Classroom label panel — CATEGORY master switches.
//
// These can hide a whole category of annotations at once (useful mid-lesson),
// but they never reveal anything: an individual label only appears when the
// teacher switches that item on in the Annotations list.

import { Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { EdgeDisplay, LabelSettings } from "@/lib/geometry3d/labelSettings";

interface Props {
  value: LabelSettings;
  onChange: (patch: Partial<LabelSettings>) => void;
  /** Radius / diameter / slant options only make sense for some solids. */
  round?: boolean;
  className?: string;
}

const GROUP_A: { key: keyof LabelSettings; label: string }[] = [
  { key: "vertices", label: "Vertex labels" },
  { key: "edges", label: "Edge labels" },
  { key: "faces", label: "Face labels" },
  { key: "angles", label: "Angle labels" },
  { key: "measurements", label: "Measurements" },
  { key: "coordinates", label: "Coordinates" },
];

const GROUP_B: { key: keyof LabelSettings; label: string }[] = [
  { key: "construction", label: "Construction lines" },
];

const EDGE_MODES: { id: EdgeDisplay; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "length", label: "Length" },
  { id: "both", label: "Both" },
];

export function LabelSettingsPanel({ value, onChange, className }: Props) {
  const row = (key: keyof LabelSettings, label: string) => (
    <div key={key} className="flex items-center justify-between gap-2 py-0.5">
      <Label className="text-[11px] font-normal">{label}</Label>
      <Switch
        checked={Boolean(value[key])}
        onCheckedChange={(v) => onChange({ [key]: v } as Partial<LabelSettings>)}
      />
    </div>
  );

  return (
    <div className={cn("rounded-md border border-border bg-background/60 p-2", className)}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Eye className="h-3.5 w-3.5" /> Label categories
      </p>
      {GROUP_A.map((g) => row(g.key, g.label))}

      <div className="my-1.5 border-t border-border" />
      {GROUP_B.map((g) => row(g.key, g.label))}

      <div className="my-1.5 border-t border-border" />
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Edges show</p>
      <div className="inline-flex w-full rounded-md border border-border p-0.5">
        {EDGE_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange({ edgeDisplay: m.id })}
            className={cn(
              "flex-1 rounded px-1 py-0.5 text-[11px] transition",
              value.edgeDisplay === m.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <Label className="text-[11px] font-normal">Hide labels behind faces</Label>
        <Switch
          checked={value.hideOccluded}
          onCheckedChange={(v) => onChange({ hideOccluded: v })}
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Off = hidden labels fade instead of disappearing.
      </p>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        These switches only hide categories. Add and reveal individual labels in
        the Annotations list.
      </p>
    </div>
  );
}

export default LabelSettingsPanel;
