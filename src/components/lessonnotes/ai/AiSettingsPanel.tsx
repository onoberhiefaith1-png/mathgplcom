// Teacher-facing AI settings, rendered INSIDE the AI popover rectangle
// (top-right gear). No second popover — the same rectangle flips to this view.

import { ChevronLeft, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AiPreferences,
  AiDepth,
  DEFAULT_AI_PREFERENCES,
} from "./aiPreferences";

interface Props {
  value: AiPreferences;
  onChange: (next: AiPreferences) => void;
  onBack: () => void;
}

const SWITCHES: { key: keyof AiPreferences; label: string; hint: string }[] = [
  { key: "stepByStep", label: "Step-by-step working", hint: "One micro-step per line" },
  { key: "simplifyEnglish", label: "Simplify English", hint: "Short, plain sentences" },
  { key: "realLife", label: "Real-life example", hint: "Anchor in a familiar situation" },
  { key: "scaffolded", label: "Scaffolded", hint: "Hint before the full answer" },
  { key: "formulaFirst", label: "Show formula first", hint: "Rule, then apply it" },
  { key: "commonMistakes", label: "Common mistakes", hint: "Close with a warning note" },
];

const DEPTHS: { id: AiDepth; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "standard", label: "Standard" },
  { id: "detailed", label: "Detailed" },
];

export function AiSettingsPanel({ value, onChange, onBack }: Props) {
  const set = (patch: Partial<AiPreferences>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-popover-foreground/80 hover:text-foreground rounded px-1 py-0.5 hover:bg-foreground/5"
        >
          <ChevronLeft className="h-3 w-3" /> Back
        </button>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-popover-foreground/75">
          AI settings
        </span>
      </div>

      <div className="space-y-1">
        {SWITCHES.map((s) => {
          const on = Boolean(value[s.key]);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => set({ [s.key]: !on } as Partial<AiPreferences>)}
              className="w-full flex items-center gap-2 text-left px-1.5 py-1 rounded hover:bg-foreground/5"
            >
              <span
                className={cn(
                  "h-4 w-7 rounded-full shrink-0 transition relative",
                  on ? "bg-primary" : "bg-popover-foreground/25",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-3 w-3 rounded-full bg-popover shadow-sm transition-all",
                    on ? "left-3.5" : "left-0.5",
                  )}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-popover-foreground leading-tight">{s.label}</span>
                <span className="block text-[10px] text-popover-foreground/70 leading-tight">{s.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-popover-foreground/75 px-0.5">Depth</p>
        <div className="flex gap-1">
          {DEPTHS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => set({ depth: d.id })}
              className={cn(
                "flex-1 text-[11px] py-1 rounded border transition",
                value.depth === d.id
                  ? "border-primary bg-primary/15 text-popover-foreground font-medium"
                  : "border-foreground/15 text-popover-foreground/80 hover:bg-foreground/5",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-popover-foreground/75 px-0.5">Class level</p>
        <input
          value={value.level}
          onChange={(e) => set({ level: e.target.value })}
          placeholder="e.g. SS2 · WAEC"
          className="w-full text-xs bg-transparent border border-foreground/20 rounded px-2 py-1 outline-none focus:border-primary placeholder:text-popover-foreground/50"
        />
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-popover-foreground/75 px-0.5">
          Standing instruction
        </p>
        <textarea
          value={value.standing}
          onChange={(e) => set({ standing: e.target.value })}
          rows={3}
          placeholder="Exactly what you want from every solution in this note…"
          className="w-full text-xs bg-transparent border border-foreground/20 rounded px-2 py-1 outline-none focus:border-primary placeholder:text-popover-foreground/50 resize-none"
        />
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_AI_PREFERENCES })}
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-popover-foreground/75 hover:text-foreground rounded px-1 py-0.5 hover:bg-foreground/5"
      >
        <RotateCcw className="h-3 w-3" /> Reset
      </button>
    </div>
  );
}
