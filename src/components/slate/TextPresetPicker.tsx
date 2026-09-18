import type { CSSProperties } from "react";
import type { SurfaceDef } from "@/lib/slate/surfaces";
import type { TextSettings } from "@/lib/slate/text3d";
import { TEXT_PRESETS, presetOf, baseColourOf, depthColourOf, shade } from "@/lib/slate/textPresets";
import type { TextPresetId } from "@/lib/slate/textPresets";

const SAMPLE = "2x − 3y";

/**
 * Lightweight sample of each preset. Deliberately CSS-only: the slate itself
 * already owns a WebGL context, and a second one inside the settings panel was
 * being dropped by the driver, leaving the list blank.
 */
function sampleStyle(preset: TextPresetId, main: string, depth: string): CSSProperties {
  const deep = shade(depth, -0.25);
  switch (preset) {
    case "crystal":
      return {
        color: main,
        opacity: 0.92,
        textShadow: `0 0 10px ${main}, 0 2px 0 ${depth}, 0 4px 8px ${deep}`,
      };
    case "bubble":
      return {
        color: main,
        textShadow: `0 2px 0 ${depth}, 0 5px 0 ${deep}, 0 8px 10px rgba(0,0,0,0.45)`,
        letterSpacing: "0.02em",
      };
    case "stone":
      return {
        color: shade(main, -0.15),
        textShadow: `0 -1px 0 ${deep}, 0 1px 0 ${shade(depth, 0.2)}, 0 3px 6px rgba(0,0,0,0.5)`,
      };
    case "neon":
      return {
        color: shade(main, 0.35),
        textShadow: `0 0 6px ${main}, 0 0 16px ${main}, 0 2px 0 ${deep}`,
      };
    case "royal3d":
    default:
      return {
        color: main,
        textShadow: `1px 1px 0 ${depth}, 2px 2px 0 ${depth}, 3px 3px 0 ${deep}, 4px 5px 8px rgba(0,0,0,0.5)`,
      };
  }
}

interface Props {
  surface: SurfaceDef;
  settings: TextSettings;
  onSelect: (preset: TextPresetId) => void;
}

export function TextPresetPicker({ settings, onSelect }: Props) {
  const active = presetOf(settings);
  const main = baseColourOf(settings);
  const depth = depthColourOf(settings);

  return (
    <div className="overflow-hidden rounded border border-amber-200/15 bg-black/30">
      {TEXT_PRESETS.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onSelect(preset.id)}
          aria-pressed={active === preset.id}
          className={`flex w-full items-center justify-between gap-2 border-b border-amber-200/10 px-2.5 py-2 text-left last:border-b-0 ${
            active === preset.id ? "bg-amber-200/10 ring-1 ring-inset ring-amber-300" : ""
          }`}
        >
          <span
            className="shrink-0 font-display text-lg leading-none"
            style={sampleStyle(preset.id, main, depth)}
          >
            {SAMPLE}
          </span>
          <span className="min-w-0 text-right">
            <span className="block truncate text-[11px] font-semibold text-amber-100">
              {preset.label}
            </span>
            <span className="block truncate text-[9px] text-amber-100/45">{preset.blurb}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
