// BottomPanel — slides upward from the screen bottom. Three sections:
// Values (digits/letters with top/mid/bottom positional states), Symbols
// (rich undergraduate-level library) and Structures (tree-node templates
// that drop a real container into the line and put the cursor inside).

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BOARD_STRUCTURES } from "@/lib/smartboard/boardStructures";
import { mkMatrix, type Node } from "@/lib/smartboard/mathTree";
import { MatrixCreateDialog, type MatrixDialogResult } from "@/components/lessonnotes/MatrixCreateDialog";

interface Props {
  open: boolean;
  onToggle: () => void;
  onInsertChar: (ch: string, mode: "mid" | "top" | "bot") => void;
  onInsertNode: (node: Node) => void;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  isDark: boolean;
}

const DIGITS = "0123456789".split("");
const LETTERS_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LETTERS_LOWER = "abcdefghijklmnopqrstuvwxyz".split("");

// One unified library, grouped visually but rendered as a single scroll.
const SYMBOL_GROUPS: { label: string; items: { glyph: string; title?: string }[] }[] = [
  { label: "Relations", items: [
    { glyph: "=" }, { glyph: "≠" }, { glyph: "≈" }, { glyph: "≡" }, { glyph: "≅" },
    { glyph: "∝" }, { glyph: "<" }, { glyph: ">" }, { glyph: "≤" }, { glyph: "≥" },
    { glyph: "≪" }, { glyph: "≫" }, { glyph: "∼" }, { glyph: "≃" },
  ]},
  { label: "Arithmetic & sets", items: [
    { glyph: "+" }, { glyph: "−" }, { glyph: "×" }, { glyph: "·" }, { glyph: "÷" },
    { glyph: "±" }, { glyph: "∓" }, { glyph: "⊕" }, { glyph: "⊗" }, { glyph: "⊙" },
    { glyph: "∘" }, { glyph: "∖" },
    { glyph: "∩" }, { glyph: "∪" }, { glyph: "⊂" }, { glyph: "⊃" }, { glyph: "⊆" }, { glyph: "⊇" },
    { glyph: "∈" }, { glyph: "∉" }, { glyph: "∋" }, { glyph: "∅" },
  ]},
  { label: "Logic", items: [
    { glyph: "∧" }, { glyph: "∨" }, { glyph: "¬" }, { glyph: "⇒" }, { glyph: "⇐" },
    { glyph: "⇔" }, { glyph: "∀" }, { glyph: "∃" }, { glyph: "∄" },
    { glyph: "∴" }, { glyph: "∵" }, { glyph: "⊢" }, { glyph: "⊨" },
  ]},
  { label: "Calculus & analysis", items: [
    { glyph: "∂" }, { glyph: "∇" }, { glyph: "∫" }, { glyph: "∮" }, { glyph: "∑" },
    { glyph: "∏" }, { glyph: "∞" }, { glyph: "′" }, { glyph: "″" }, { glyph: "‴" },
    { glyph: "→" }, { glyph: "↦" }, { glyph: "⟶" }, { glyph: "↔" },
  ]},
  { label: "Greek — lowercase", items:
    ["α","β","γ","δ","ε","ζ","η","θ","ι","κ","λ","μ","ν","ξ","π","ρ","σ","τ","υ","φ","χ","ψ","ω"]
      .map(g => ({ glyph: g })),
  },
  { label: "Greek — uppercase", items:
    ["Γ","Δ","Θ","Λ","Ξ","Π","Σ","Υ","Φ","Ψ","Ω"]
      .map(g => ({ glyph: g })),
  },
  { label: "Number sets", items: [
    { glyph: "ℕ", title: "Naturals" }, { glyph: "ℤ", title: "Integers" },
    { glyph: "ℚ", title: "Rationals" }, { glyph: "ℝ", title: "Reals" },
    { glyph: "ℂ", title: "Complex" }, { glyph: "ℙ", title: "Probability / primes" },
  ]},
  { label: "Geometry", items: [
    { glyph: "°" }, { glyph: "∠" }, { glyph: "∡" }, { glyph: "△" }, { glyph: "□" },
    { glyph: "◯" }, { glyph: "∥" }, { glyph: "⟂" }, { glyph: "≅" }, { glyph: "∼" },
  ]},
  { label: "Misc", items: [
    { glyph: "ℓ" }, { glyph: "ℏ" }, { glyph: "ℑ" }, { glyph: "ℜ" },
    { glyph: "⊥" }, { glyph: "⊤" }, { glyph: "⋮" }, { glyph: "⋯" }, { glyph: "⋱" },
    { glyph: "(" }, { glyph: ")" }, { glyph: "[" }, { glyph: "]" },
    { glyph: "," }, { glyph: "." }, { glyph: "%" },
  ]},
];

type Tab = "values" | "symbols" | "structures";

export const PANEL_HEIGHT = 320;
export const TAB_HEIGHT = 22;

export const BottomPanel = ({
  open, onToggle, onInsertChar, onInsertNode, chromeBg, chromeFg, chromeBorder, isDark,
}: Props) => {
  const [tab, setTab] = useState<Tab>("values");
  const [letterCase, setLetterCase] = useState<"upper" | "lower">("lower");
  const [position, setPosition] = useState<"top" | "mid" | "bot">("mid");
  const [matrixBuilder, setMatrixBuilder] = useState(false);

  const closers: Record<string, string> = { "(": ")", "[": "]", "{": "}", "|": "|" };
  const onMatrixConfirm = (r: MatrixDialogResult) => {
    setMatrixBuilder(false);
    onInsertNode(mkMatrix(r.rows, r.cols, r.br, closers[r.br] ?? ")", r.fns ?? []));
  };

  const baseBtn: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    color: chromeFg,
    border: `1px solid ${chromeBorder}`,
  };
  const activeBtn: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
    color: chromeFg,
    border: `1px solid ${chromeBorder}`,
  };

  const groupedStructures = BOARD_STRUCTURES.reduce<Record<string, typeof BOARD_STRUCTURES>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <>
      {/* Pull-tab — the ONLY way to open the panel. Explicit click only;
          pointer events on the closed panel body are disabled. */}
      <button
        data-sb-chrome
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(); }}
        aria-label={open ? "Hide symbols" : "Show symbols"}
        className="absolute z-30 left-1/2 -translate-x-1/2 grid place-items-center rounded-t-full transition-all"
        style={{
          bottom: open ? PANEL_HEIGHT : 0,
          width: 44,
          height: TAB_HEIGHT,
          color: chromeFg,
          background: "transparent",
          boxShadow: `0 0 14px 2px ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
          opacity: 0.6,
          pointerEvents: "auto",
          touchAction: "manipulation",
        }}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      <section
        data-sb-chrome
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        className="absolute z-20 left-0 right-0 bottom-0 border-t transition-transform duration-500 ease-out"
        style={{
          height: PANEL_HEIGHT,
          transform: open ? "translateY(0)" : `translateY(${PANEL_HEIGHT}px)`,
          background: chromeBg,
          color: chromeFg,
          borderColor: chromeBorder,
          backdropFilter: "blur(14px)",
          boxShadow: open
            ? `0 -20px 60px ${isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.15)"}`
            : "none",
          // Closed panel must not catch scroll/touch/clicks that drift below
          // the canvas. Only the pull-tab above remains interactive.
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* Tabs */}
        <div className="flex items-center justify-between px-4 pt-2 pb-2 border-b" style={{ borderColor: chromeBorder }}>
          <div className="flex items-center gap-1">
            {(["values", "symbols", "structures"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1 rounded-md text-[11px] uppercase tracking-[0.18em]"
                style={tab === t ? activeBtn : baseBtn}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "values" && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 rounded-md overflow-hidden" style={{ border: `1px solid ${chromeBorder}` }}>
                {(["top", "mid", "bot"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPosition(p)}
                    title={p === "top" ? "Exponent" : p === "bot" ? "Subscript" : "Normal"}
                    className="px-2 py-1 text-[11px]"
                    style={position === p ? activeBtn : baseBtn}
                  >
                    {p === "top" ? "x²" : p === "bot" ? "x₂" : "x"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-0.5 rounded-md overflow-hidden" style={{ border: `1px solid ${chromeBorder}` }}>
                {(["upper", "lower"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setLetterCase(c)}
                    className="px-2 py-1 text-[11px]"
                    style={letterCase === c ? activeBtn : baseBtn}
                  >
                    {c === "upper" ? "A" : "a"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3 overflow-y-auto" style={{ height: PANEL_HEIGHT - 56 }}>
          {tab === "values" && (
            <div className="space-y-3">
              <Row items={DIGITS.map(g => ({ glyph: g }))} onTap={(c) => onInsertChar(c, position)} btnStyle={baseBtn} />
              <Row
                items={(letterCase === "upper" ? LETTERS_UPPER : LETTERS_LOWER).map(g => ({ glyph: g }))}
                onTap={(c) => onInsertChar(c, position)}
                btnStyle={baseBtn}
              />
            </div>
          )}

          {tab === "symbols" && (
            <div className="space-y-3">
              {SYMBOL_GROUPS.map((g) => (
                <div key={g.label}>
                  <div className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-1">{g.label}</div>
                  <Row items={g.items} onTap={(c) => onInsertChar(c, "mid")} btnStyle={baseBtn} />
                </div>
              ))}
            </div>
          )}

          {tab === "structures" && (
            <div className="space-y-3">
              {Object.entries(groupedStructures).map(([group, items]) => (
                <div key={group}>
                  <div className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-1">{group}</div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => (s.dialog === "matrix" ? setMatrixBuilder(true) : onInsertNode(s.build()))}
                        className="px-3 py-2 rounded-md text-sm min-w-[68px] hover:scale-[1.04] active:scale-95 transition-transform"
                        style={baseBtn}
                        title={s.title}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {matrixBuilder && (
        <MatrixCreateDialog
          kind="matrix"
          onCancel={() => setMatrixBuilder(false)}
          onConfirm={onMatrixConfirm}
        />
      )}
    </>
  );
};

const Row = ({
  items, onTap, btnStyle,
}: { items: { glyph: string; title?: string }[]; onTap: (c: string) => void; btnStyle: React.CSSProperties }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((it, i) => (
      <button
        key={`${it.glyph}-${i}`}
        onClick={() => onTap(it.glyph)}
        title={it.title ?? it.glyph}
        className="grid place-items-center rounded-md text-base hover:scale-[1.05] active:scale-95 transition-transform"
        style={{ ...btnStyle, width: 36, height: 36 }}
      >
        {it.glyph}
      </button>
    ))}
  </div>
);

export default BottomPanel;
