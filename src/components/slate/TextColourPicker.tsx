import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { TEXT_COLOURS } from "@/lib/slate/text3d";
import type { TextSettings } from "@/lib/slate/text3d";

/** hex -> {h,s,v} with h in degrees, s/v in 0..1 */
export function hexToHsv(hex: string) {
  const clean = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const seg = Math.floor(h / 60) % 6;
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[seg] ?? [c, x, 0];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const isHex = (v: string) => /^#?[0-9a-fA-F]{6}$/.test(v.trim());
const rgbOf = (hex: string) => {
  const c = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
};

type Colourable = Pick<TextSettings, "colour" | "opacity"> & { swatches?: string[] };

interface Props {
  text: Colourable;
  onChange: (patch: Partial<Colourable>) => void;
  heading?: string;
}

/**
 * The full text-colour control: presets, hue / saturation / brightness,
 * opacity, hex + rgb entry, a live preview and saved swatches.
 * Colour is independent of style, material, glow, shadow and highlight.
 */
export function TextColourPicker({ text, onChange, heading = "Text colour" }: Props) {
  const current = text.colour ?? "#efe3c8";
  const hsv = useMemo(() => hexToHsv(current), [current]);
  const swatches = text.swatches ?? [];
  const rgb = rgbOf(current);

  const setHsv = (patch: Partial<{ h: number; s: number; v: number }>) =>
    onChange({ colour: hsvToHex(patch.h ?? hsv.h, patch.s ?? hsv.s, patch.v ?? hsv.v) });

  const saveSwatch = () => {
    if (swatches.includes(current)) return;
    onChange({ swatches: [current, ...swatches].slice(0, 12) });
  };

  const label = "block text-[11px] uppercase tracking-wider text-amber-100/60";

  return (
    <div className="space-y-2.5">
      <span className={label}>{heading}</span>

      <div className="grid grid-cols-4 gap-1">
        {TEXT_COLOURS.map((c) => {
          const chosen = (text.colour ?? "") === c.value;
          return (
            <button
              key={c.label}
              title={c.label}
              aria-label={c.label}
              onClick={() => onChange({ colour: c.value === "" ? null : c.value })}
              className={`h-7 rounded border ${
                chosen ? "border-amber-300 ring-1 ring-amber-300/60" : "border-amber-200/20"
              }`}
              style={
                c.value
                  ? { background: c.value }
                  : {
                      background:
                        "repeating-linear-gradient(45deg,#3a2b17,#3a2b17 4px,#1a130a 4px,#1a130a 8px)",
                    }
              }
            />
          );
        })}
      </div>

      {/* preview + native picker */}
      <div className="flex items-center gap-2">
        <div
          className="h-9 w-14 shrink-0 rounded border border-amber-200/25"
          style={{ background: current, opacity: text.opacity }}
          aria-label="Colour preview"
        />
        <input
          type="color"
          aria-label="Custom text colour"
          value={current}
          onChange={(e) => onChange({ colour: e.target.value })}
          className="h-9 w-10 shrink-0 rounded border border-amber-200/20 bg-transparent"
        />
        <span className="min-w-0 truncate text-[10px] uppercase tracking-wider text-amber-100/45">
          {text.colour ? `rgb(${rgb.join(", ")})` : "material default"}
        </span>
      </div>

      {/* hue / saturation / brightness */}
      <div className="space-y-1">
        <span className="block text-[10px] uppercase tracking-wider text-amber-100/45">Hue</span>
        <Slider
          value={[hsv.h]}
          min={0}
          max={359}
          step={1}
          onValueChange={([v]) => setHsv({ h: v ?? hsv.h })}
        />
      </div>
      <div className="space-y-1">
        <span className="block text-[10px] uppercase tracking-wider text-amber-100/45">
          Saturation
        </span>
        <Slider
          value={[hsv.s]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v]) => setHsv({ s: v ?? hsv.s })}
        />
      </div>
      <div className="space-y-1">
        <span className="block text-[10px] uppercase tracking-wider text-amber-100/45">
          Brightness
        </span>
        <Slider
          value={[hsv.v]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v]) => setHsv({ v: v ?? hsv.v })}
        />
      </div>
      <div className="space-y-1">
        <span className="block text-[10px] uppercase tracking-wider text-amber-100/45">Opacity</span>
        <Slider
          value={[text.opacity]}
          min={0.1}
          max={1}
          step={0.01}
          onValueChange={([v]) => onChange({ opacity: v ?? text.opacity })}
        />
      </div>

      {/* hex / rgb entry */}
      <div className="flex items-center gap-1.5">
        <input
          aria-label="Hex colour"
          defaultValue={current}
          key={current}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (isHex(v)) onChange({ colour: v.startsWith("#") ? v : `#${v}` });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-7 w-24 rounded border border-amber-200/20 bg-black/30 px-2 text-[11px] text-amber-100"
        />
        <input
          aria-label="RGB colour"
          defaultValue={rgb.join(", ")}
          key={`rgb-${current}`}
          onBlur={(e) => {
            const parts = e.target.value.split(/[,\s]+/).map((n) => parseInt(n, 10));
            if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
              onChange({
                colour: `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`,
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-7 min-w-0 flex-1 rounded border border-amber-200/20 bg-black/30 px-2 text-[11px] text-amber-100"
        />
        <button
          onClick={saveSwatch}
          className="h-7 shrink-0 rounded border border-amber-200/25 px-2 text-[10px] uppercase tracking-wider text-amber-100/80 hover:bg-amber-200/10"
        >
          Save
        </button>
      </div>

      {swatches.length ? (
        <div className="grid grid-cols-6 gap-1">
          {swatches.map((c) => (
            <button
              key={c}
              title={c}
              aria-label={`Saved colour ${c}`}
              onClick={() => onChange({ colour: c })}
              onContextMenu={(e) => {
                e.preventDefault();
                onChange({ swatches: swatches.filter((x) => x !== c) });
              }}
              className={`h-6 rounded border ${
                current === c ? "border-amber-300" : "border-amber-200/20"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
