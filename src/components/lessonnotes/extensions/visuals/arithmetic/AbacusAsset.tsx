// Abacus asset — thin wrapper around the game Abacus so it can be dropped
// inside lesson notes as a manipulative.

import { useCallback, useMemo } from "react";
import { Abacus, type AbacusDigits } from "@/components/abacus/Abacus";

interface Attrs { digits?: AbacusDigits }

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}

function normalize(a: Record<string, unknown>): AbacusDigits {
  const d = (a.digits && typeof a.digits === "object") ? a.digits as Partial<AbacusDigits> : {};
  const n = (v: unknown) => {
    const x = Number(v); return Number.isFinite(x) && x >= 0 && x <= 9 ? Math.floor(x) : 0;
  };
  return { th: n(d.th), h: n(d.h), t: n(d.t), u: n(d.u) };
}

export function AbacusAsset({ attrs, onChange }: Props) {
  const digits = useMemo(() => normalize(attrs), [attrs]);
  const set = useCallback((next: AbacusDigits) => onChange({ digits: next }), [onChange]);
  return (
    <div className="not-prose inline-block" style={{ transform: "scale(0.7)", transformOrigin: "top left" }}>
      <Abacus
        digits={digits}
        enabled={{ th: true, h: true, t: true, u: true }}
        onChange={set}
      />
    </div>
  );
}

export default AbacusAsset;
