// StylesRail — minimal, semi-transparent right-edge sidebar that shows live
// mini-previews of each writing profile. Clicking re-skins ALL board writing
// instantly via the shared writing profile context.

import {
  PROFILE_LIST, WritingProfile, WritingProfileId,
} from "@/lib/smartboard/writingProfiles";
import { COLOR_LIST, InkColorId, resolveInk } from "@/lib/smartboard/inkColors";
import { WritingSurface } from "./WritingSurface";

interface Props {
  profileId: WritingProfileId;
  setProfileId: (id: WritingProfileId) => void;
  inkColorId: InkColorId;
  setInkColorId: (id: InkColorId) => void;
  surface: "whiteboard" | "blackboard";
  visible: boolean;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
}

const SAMPLES = [
  "x^{2} + 5x - 7 = 0",
  "\\sqrt{54 + 2x}",
  "\\frac{5}{4}",
];

export const StylesRail = ({
  profileId, setProfileId, inkColorId, setInkColorId,
  surface, visible, chromeBg, chromeFg, chromeBorder,
}: Props) => {
  const ink = resolveInk(inkColorId, surface);

  return (
    <aside
      data-sb-chrome
      className="absolute right-0 top-14 bottom-0 z-20 flex flex-col gap-2 p-2 border-l overflow-y-auto transition-opacity duration-500"
      style={{
        width: 168,
        background: chromeBg,
        color: chromeFg,
        borderColor: chromeBorder,
        backdropFilter: "blur(10px)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="text-[9px] uppercase tracking-[0.22em] opacity-60 px-1 pt-1">
        Ink
      </div>
      <div className="flex flex-wrap gap-1.5 px-1 pb-1">
        {COLOR_LIST.map((c) => {
          const swatch = c[surface];
          const active = c.id === inkColorId;
          return (
            <button
              key={c.id}
              title={c.label}
              onClick={() => setInkColorId(c.id)}
              className="rounded-full"
              style={{
                width: 18,
                height: 18,
                background: swatch,
                border: active
                  ? `2px solid ${chromeFg}`
                  : `1px solid ${chromeBorder}`,
              }}
              aria-label={`Ink ${c.label}`}
            />
          );
        })}
      </div>

      <div className="text-[9px] uppercase tracking-[0.22em] opacity-60 px-1 pt-1">
        Styles
      </div>
      {PROFILE_LIST.map((p: WritingProfile, idx) => {
        const active = p.id === profileId;
        return (
          <button
            key={p.id}
            onClick={() => setProfileId(p.id)}
            className="text-left rounded-md p-2 transition-colors"
            style={{
              border: active
                ? `1px solid ${chromeFg}`
                : `1px solid ${chromeBorder}`,
              background: active ? "rgba(255,255,255,0.06)" : "transparent",
            }}
          >
            <div className="text-[10px] font-medium mb-1 truncate" style={{ color: chromeFg }}>
              {p.label}
            </div>
            <WritingSurface
              profile={p}
              inkColor={ink}
              surface={surface}
              className="rounded px-2 py-1.5 text-[13px] leading-tight"
              style={{
                background: surface === "whiteboard" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)",
                minHeight: 36,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ whiteSpace: "nowrap" }}>
                {/* deterministic single sample per profile so the rail varies */}
                {renderSimple(SAMPLES[idx % SAMPLES.length])}
              </span>
            </WritingSurface>
          </button>
        );
      })}
    </aside>
  );
};

// Lightweight sample renderer (avoids pulling MathRender here): handles
// ^{...}, \frac{a}{b}, \sqrt{...}. Sufficient for the rail previews.
const renderSimple = (s: string): React.ReactNode => {
  // \frac
  const frac = s.match(/^\\frac\{([^{}]+)\}\{([^{}]+)\}$/);
  if (frac) {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
        <span style={{ fontSize: "0.85em" }}>{frac[1]}</span>
        <span style={{ borderTop: "1.5px solid currentColor", padding: "0 4px", margin: "1px 0" }} />
        <span style={{ fontSize: "0.85em" }}>{frac[2]}</span>
      </span>
    );
  }
  // \sqrt{...}
  const sqrt = s.match(/^\\sqrt\{([^{}]+)\}$/);
  if (sqrt) {
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline" }}>
        <span>√</span>
        <span style={{ borderTop: "1.5px solid currentColor", paddingLeft: 2 }}>{sqrt[1]}</span>
      </span>
    );
  }
  // ^{...}
  const parts = s.split(/(\^\{[^{}]+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\^\{([^{}]+)\}$/);
        if (m) return <sup key={i} style={{ fontSize: "0.7em" }}>{m[1]}</sup>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
};

export default StylesRail;
