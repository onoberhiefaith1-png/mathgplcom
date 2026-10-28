// Fraction Strip — a single fraction wall row. Opens empty (denominator
// only, no shading) so the teacher configures numerator/denominator via
// the right-hand panel of the underlying Fraction Wall.

import { FractionWall } from "./FractionWall";

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

export function FractionStrip({ attrs, onChange, selected }: Props) {
  const src = (attrs as any).rows;
  const singleAttrs = {
    ...attrs,
    rows: Array.isArray(src) && src.length > 0
      ? [src[0]]
      : [{ parts: 1, label: "1", shaded: [false], color: "#3b82f6" }],
  };
  return <FractionWall attrs={singleAttrs} onChange={onChange} selected={selected} />;
}

export default FractionStrip;
