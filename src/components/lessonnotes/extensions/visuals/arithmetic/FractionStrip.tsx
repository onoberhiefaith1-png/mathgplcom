// Fraction Strip — single strip (a Fraction Wall row on its own).

import { FractionWall } from "./FractionWall";

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

export function FractionStrip({ attrs, onChange, selected }: Props) {
  // Force a single row into the FractionWall model so we get one strip.
  const singleAttrs = {
    ...attrs,
    rows: Array.isArray((attrs as any).rows) && (attrs as any).rows.length > 0
      ? [(attrs as any).rows[0]]
      : [{ parts: 4, label: "1", shaded: [false, false, false, false], color: "hsl(var(--primary))" }],
  };
  return <FractionWall attrs={singleAttrs} onChange={onChange} selected={selected} />;
}

export default FractionStrip;
