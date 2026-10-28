import { useRef, useState } from "react";
import { Scan, Sigma, Type, X } from "lucide-react";

type Tool = "grouping" | "symbols" | "letters";

interface Props {
  onInsert: (ascii: string) => void;
}

// Symbol cycle groups — tap repeatedly to step through, hold to open the wheel.
const SYMBOL_CYCLES: Record<string, string[]> = {
  op:      ["+", "−", "×", "÷", "="],
  bracket: ["(", "[", "{", "|"],
  rel:     ["<", ">", "≤", "≥"],
  pow:     ["²", "³", "ⁿ"],
  root:    ["√", "∛"],
};
const SYMBOL_GROUPS: { id: string; label: string }[] = [
  { id: "op",      label: "+" },
  { id: "bracket", label: "( )" },
  { id: "rel",     label: "<" },
  { id: "pow",     label: "x²" },
  { id: "root",    label: "√" },
  // Always-on singletons
];
const SINGLETONS = ["π", ")", "}"];
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

export const RightTools = ({ onInsert }: Props) => {
  const [open, setOpen] = useState<Tool | null>(null);

  const close = () => setOpen(null);

  return (
    <>
      {/* Vertical icon rail */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        <ToolBtn icon={<Scan className="h-4 w-4" />} label="Visual Grouping" active={open === "grouping"} onClick={() => setOpen(open === "grouping" ? null : "grouping")} accent="hsl(280 80% 70%)" />
        <ToolBtn icon={<Sigma className="h-4 w-4" />} label="Symbols"        active={open === "symbols"}  onClick={() => setOpen(open === "symbols"  ? null : "symbols")}  accent="hsl(160 70% 60%)" />
        <ToolBtn icon={<Type className="h-4 w-4" />}  label="Letters"        active={open === "letters"}  onClick={() => setOpen(open === "letters"  ? null : "letters")}  accent="hsl(200 80% 65%)" />
      </div>

      {/* Bottom-half assistant panel */}
      {open && (
        <div
          className="absolute left-0 right-0 bottom-0 z-10 px-8 md:px-16 pb-32 pt-6 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200"
          style={{
            background: "color-mix(in oklab, var(--sb-bg) 78%, transparent)",
            borderTop: "1px solid color-mix(in oklab, var(--sb-fg) 8%, transparent)",
          }}
        >
          <div className="flex items-center justify-between mb-3" style={{ color: "var(--sb-muted)" }}>
            <div className="text-xs uppercase tracking-[0.18em]">
              {open === "grouping" ? "Visual Grouping" : open === "symbols" ? "Symbols" : "Letters"}
            </div>
            <button onClick={close} className="p-1 rounded-full hover:bg-[color-mix(in_oklab,var(--sb-fg)_8%,transparent)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {open === "grouping" && (
            <div className="text-sm py-10 text-center" style={{ color: "var(--sb-muted)" }}>
              Visual Grouping aids — coming soon. This space will host grouping models, fraction visuals,
              long division and algebra-movement aids while you solve.
            </div>
          )}

          {open === "symbols" && (
            <div className="flex flex-wrap gap-2">
              {SYMBOL_GROUPS.map((g) => (
                <CycleChip
                  key={g.id}
                  initial={g.label}
                  variants={SYMBOL_CYCLES[g.id]}
                  onInsert={onInsert}
                />
              ))}
              {SINGLETONS.map((s) => (
                <ChipBtn key={s} onClick={() => onInsert(s)} label={s} />
              ))}
            </div>
          )}

          {open === "letters" && (
            <div className="flex flex-wrap gap-2">
              {LETTERS.map((s) => (
                <ChipBtn key={s} onClick={() => onInsert(s)} label={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

const ToolBtn = ({
  icon, label, active, onClick, accent,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; accent: string }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center gap-1"
    title={label}
  >
    <div
      className="h-10 w-10 rounded-full grid place-items-center transition-all"
      style={{
        background: active ? `color-mix(in oklab, ${accent} 20%, transparent)` : "color-mix(in oklab, var(--sb-fg) 5%, transparent)",
        color: active ? accent : "var(--sb-muted)",
        boxShadow: active ? `0 0 18px color-mix(in oklab, ${accent} 40%, transparent)` : undefined,
        border: `1px solid color-mix(in oklab, ${active ? accent : "var(--sb-fg)"} 15%, transparent)`,
      }}
    >
      {icon}
    </div>
    <span className="text-[10px]" style={{ color: active ? accent : "var(--sb-muted)" }}>{label}</span>
  </button>
);

const ChipBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 rounded-full text-base transition hover:scale-105 active:scale-95"
    style={{
      color: "var(--sb-fg)",
      background: "color-mix(in oklab, var(--sb-fg) 5%, transparent)",
      border: "1px solid color-mix(in oklab, var(--sb-fg) 10%, transparent)",
    }}
  >
    {label}
  </button>
);

/**
 * CycleChip — tap repeatedly to step through symbol variants and INSERT the
 * displayed variant on each tap. Hold to open a small wheel with all forms.
 */
const CycleChip = ({
  initial, variants, onInsert,
}: { initial: string; variants: string[]; onInsert: (s: string) => void }) => {
  const [idx, setIdx] = useState(() => Math.max(0, variants.indexOf(initial)));
  const [wheel, setWheel] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const armed = useRef(false);

  const startHold = () => {
    armed.current = true;
    holdTimer.current = window.setTimeout(() => {
      armed.current = false;
      setWheel(true);
    }, 350);
  };
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (armed.current) {
      // it was a tap → insert current and advance
      onInsert(variants[idx]);
      setIdx((i) => (i + 1) % variants.length);
    }
    armed.current = false;
  };

  return (
    <div className="relative">
      <button
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={() => { if (holdTimer.current) window.clearTimeout(holdTimer.current); armed.current = false; }}
        className="px-3 py-1.5 rounded-full text-base transition hover:scale-105 active:scale-95"
        style={{
          color: "var(--sb-fg)",
          background: "color-mix(in oklab, var(--sb-fg) 5%, transparent)",
          border: "1px solid color-mix(in oklab, var(--sb-fg) 10%, transparent)",
        }}
        title="Tap to cycle, hold for all variants"
      >
        {variants[idx]}
      </button>
      {wheel && (
        <div
          className="absolute z-30 left-1/2 -translate-x-1/2 mt-1 flex gap-1 p-1 rounded-full shadow-lg backdrop-blur-md"
          style={{
            background: "color-mix(in oklab, var(--sb-bg) 85%, transparent)",
            border: "1px solid color-mix(in oklab, var(--sb-fg) 12%, transparent)",
          }}
        >
          {variants.map((v, i) => (
            <button
              key={v}
              onClick={() => { onInsert(v); setIdx(i); setWheel(false); }}
              className="h-8 w-8 grid place-items-center rounded-full text-base hover:bg-[color-mix(in_oklab,var(--sb-fg)_8%,transparent)]"
              style={{ color: "var(--sb-fg)" }}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RightTools;
