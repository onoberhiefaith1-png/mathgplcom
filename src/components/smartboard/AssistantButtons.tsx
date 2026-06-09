// Three permanent activation buttons for the workspace assistants.
// Floating Numbers (bottom-left), Structures (bottom-right), Symbols
// (right-edge middle). Tapping one toggles it; activating any auto-hides
// the others (mutual exclusion handled by the parent).

import { Hash, FunctionSquare, Sigma } from "lucide-react";

export type Assistant = "numbers" | "structures" | "symbols";

interface Props {
  active: Assistant | null;
  onToggle: (k: Assistant) => void;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  ink: string;
  /** Bottom inset (px) so the buttons clear the BottomPanel tab. */
  bottomInset: number;
  /** Extra lift (px) for the bottom-right Structures button so it clears a
   *  fixed bottom-right element (e.g. the per-line "Check line" button). */
  liftRightBottom?: number;
}

const btnStyle = (
  isActive: boolean,
  palette: { chromeBg: string; chromeFg: string; chromeBorder: string; ink: string },
): React.CSSProperties => ({
  width: 44,
  height: 44,
  background: palette.chromeBg,
  color: isActive ? palette.ink : palette.chromeFg,
  borderColor: isActive ? palette.ink : palette.chromeBorder,
  boxShadow: isActive
    ? `0 0 14px ${palette.ink}, 0 2px 10px rgba(0,0,0,0.18)`
    : "0 2px 10px rgba(0,0,0,0.18)",
  backdropFilter: "blur(10px)",
  opacity: 0.95,
});

export const AssistantButtons = ({
  active, onToggle, chromeBg, chromeFg, chromeBorder, ink, bottomInset,
  liftRightBottom = 0,
}: Props) => {
  const palette = { chromeBg, chromeFg, chromeBorder, ink };
  return (
    <>
      {/* Floating Numbers — bottom-left */}
      <button
        data-sb-chrome
        onClick={(e) => { e.stopPropagation(); onToggle("numbers"); }}
        aria-label="Toggle floating numbers"
        title="Floating numbers"
        className="fixed z-40 grid place-items-center rounded-full border transition-all"
        style={{ left: 12, bottom: bottomInset + 12, ...btnStyle(active === "numbers", palette) }}
      >
        <Hash className="h-5 w-5" />
      </button>

      {/* Structures — bottom-right */}
      <button
        data-sb-chrome
        onClick={(e) => { e.stopPropagation(); onToggle("structures"); }}
        aria-label="Toggle structures"
        title="Structures (□/□, √□, …)"
        className="fixed z-40 grid place-items-center rounded-full border transition-all"
        style={{ right: 12, bottom: bottomInset + 12, ...btnStyle(active === "structures", palette) }}
      >
        <FunctionSquare className="h-5 w-5" />
      </button>

      {/* Symbols — right-edge middle */}
      <button
        data-sb-chrome
        onClick={(e) => { e.stopPropagation(); onToggle("symbols"); }}
        aria-label="Toggle symbols"
        title="Symbols (+ − × ÷ = …)"
        className="fixed z-40 grid place-items-center rounded-full border transition-all"
        style={{ right: 12, top: "50%", transform: "translateY(-50%)", ...btnStyle(active === "symbols", palette) }}
      >
        <Sigma className="h-5 w-5" />
      </button>
    </>
  );
};

export default AssistantButtons;
