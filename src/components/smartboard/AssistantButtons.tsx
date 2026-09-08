// Permanent activation button for the Floating Numbers workspace (bottom-left
// on desktop). The Structures (F) and Symbols (Σ) openers were removed by
// request and are not replaced.

import { Hash } from "lucide-react";

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
  /** Phone/tablet only: absolute placement override so the parent can suspend
   *  this control above the measured Floating Number workspace. */
  positionOverride?: React.CSSProperties;
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
  positionOverride,
}: Props) => {
  const palette = { chromeBg, chromeFg, chromeBorder, ink };
  return (
    <>
      {/* Floating Numbers — bottom-left (desktop) or above the workspace (touch) */}
      <button
        data-sb-chrome
        onClick={(e) => { e.stopPropagation(); onToggle("numbers"); }}
        aria-label="Toggle floating numbers"
        title="Floating numbers"
        className="absolute z-40 grid place-items-center rounded-full border transition-all"
        style={{
          left: 12,
          bottom: bottomInset + 12,
          ...btnStyle(active === "numbers", palette),
          ...(positionOverride ?? null),
        }}
      >
        <Hash className="h-5 w-5" />
      </button>
    </>
  );
};

export default AssistantButtons;
