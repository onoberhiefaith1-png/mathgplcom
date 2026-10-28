import { memo } from "react";
import { AbacusRod, BeadKind } from "./AbacusRod";

export interface AbacusDigits {
  th: number;
  h: number;
  t: number;
  u: number;
}

export interface AbacusProps {
  digits: AbacusDigits;
  enabled: { th: boolean; h: boolean; t: boolean; u: boolean };
  wrongCols?: Partial<Record<keyof AbacusDigits, boolean>>;
  correct?: boolean;
  onChange: (next: AbacusDigits) => void;
}

const BEADS: Record<keyof AbacusDigits, BeadKind> = {
  th: "sapphire",
  h: "emerald",
  t: "amber",
  u: "amethyst",
};

export const Abacus = memo(function Abacus({
  digits,
  enabled,
  wrongCols = {},
  correct = false,
  onChange,
}: AbacusProps) {
  const set = (k: keyof AbacusDigits) => (v: number) => onChange({ ...digits, [k]: v });
  const hl = (k: keyof AbacusDigits) =>
    correct ? "correct" : wrongCols[k] ? "wrong" : "none";

  return (
    <div className="rounded-2xl border-4 border-amber-900/80 bg-gradient-to-b from-amber-950/40 to-amber-900/30 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-end justify-center gap-2 sm:gap-4">
        <AbacusRod label="TH" sub="1000" digit={digits.th} bead={BEADS.th} disabled={!enabled.th} highlight={hl("th")} onSetDigit={set("th")} />
        <AbacusRod label="H"  sub="100"  digit={digits.h}  bead={BEADS.h}  disabled={!enabled.h}  highlight={hl("h")}  onSetDigit={set("h")} />
        <AbacusRod label="T"  sub="10"   digit={digits.t}  bead={BEADS.t}  disabled={!enabled.t}  highlight={hl("t")}  onSetDigit={set("t")} />
        <AbacusRod label="U"  sub="1"    digit={digits.u}  bead={BEADS.u}  disabled={!enabled.u}  highlight={hl("u")}  onSetDigit={set("u")} />
      </div>
    </div>
  );
});
