// WritingLab — live preview sandbox for the active writing profile, ink color
// and board surface. Teachers can type an expression and feel how it renders
// before applying globally. Lives inside the SettingsSheet.

import { useState } from "react";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { WritingSurface } from "./WritingSurface";
import { WritingProfile } from "@/lib/smartboard/writingProfiles";
import { Inked } from "./Inked";

const PRESETS: { label: string; src: string }[] = [
  { label: "Quadratic",    src: "x^{2} + 5x - 7 = 0" },
  { label: "Fraction",     src: "x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}" },
  { label: "Root",         src: "\\sqrt{54 + 2x}" },
  { label: "Integral",     src: "\\int (3x^{2} + 4x)\\,dx" },
  { label: "Power",        src: "f(x) = 2x^{2} - 3x + 1" },
];

interface Props {
  profile: WritingProfile;
  inkColor: string;
  placeholderColor: string;
  surface: "whiteboard" | "blackboard";
  /** background for the lab preview (matches active surface) */
  surfaceBg: string;
  chromeFg: string;
  chromeBorder: string;
}

export const WritingLab = ({ profile, inkColor, placeholderColor, surface, surfaceBg, chromeFg, chromeBorder }: Props) => {
  const [src, setSrc] = useState(PRESETS[1].src);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setSrc(p.src)}
            className="px-2 py-0.5 rounded-md text-[10px] border"
            style={{
              borderColor: chromeBorder,
              color: chromeFg,
              background: src === p.src ? "rgba(0,0,0,0.06)" : "transparent",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        value={src}
        onChange={(e) => setSrc(e.target.value)}
        className="w-full px-2 py-1.5 rounded-md text-xs border bg-transparent"
        style={{ borderColor: chromeBorder, color: chromeFg }}
        placeholder="Type an expression…"
      />
      <div
        className="rounded-lg overflow-hidden border"
        style={{ borderColor: chromeBorder, background: surfaceBg, padding: "20px 16px", minHeight: 110 }}
      >
        <WritingSurface profile={profile} inkColor={inkColor} surface={surface}>
          <div style={{ fontSize: 22 }}>
            <Inked jitter={profile.strokeJitter} seed={src.length}>
              {"\u00A0"}
            </Inked>
            {renderMathInline(src, `lab-${src.length}`, { placeholderColor })}
          </div>
        </WritingSurface>
      </div>
    </div>
  );
};

export default WritingLab;
