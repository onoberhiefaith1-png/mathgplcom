// Colour belongs to the geometry object, not to the formula.
//
// A property such as `BC^2 = CA^2 + AB^2` is rendered ONCE through the shared
// math renderer, but each geometry reference inside it is painted with the
// colour of the object it is bound to (by id, never by matching text alone).

import type { ReactNode } from "react";
import { MathText } from "@/lib/geometry/map/renderStatement";

export interface TokenColor {
  token: string;
  color: string;
}

/**
 * Splits the statement on its geometry references and paints each reference
 * with its object colour. Anything that is not a reference keeps the ink
 * colour of the surrounding text, so the formula is never one flat colour.
 */
export function ColoredMathText({
  value,
  tokens,
}: {
  value: string;
  tokens: TokenColor[];
}) {
  if (!value) return null;
  const marks = tokens.filter((t) => t.token && value.includes(t.token));
  if (marks.length === 0) return <MathText value={value} />;

  const parts: ReactNode[] = [];
  let rest = value;
  let key = 0;
  let guard = 0;

  while (rest && guard++ < 400) {
    // The earliest reference left in the remaining text (longest match wins).
    let best: { index: number; mark: TokenColor } | null = null;
    for (const mark of marks) {
      const index = rest.indexOf(mark.token);
      if (index < 0) continue;
      if (
        !best ||
        index < best.index ||
        (index === best.index && mark.token.length > best.mark.token.length)
      ) {
        best = { index, mark };
      }
    }
    if (!best) break;
    if (best.index > 0) {
      parts.push(<MathText key={`t${key++}`} value={rest.slice(0, best.index)} />);
    }
    parts.push(
      <span key={`c${key++}`} style={{ color: best.mark.color }}>
        <MathText value={best.mark.token} />
      </span>,
    );
    rest = rest.slice(best.index + best.mark.token.length);
  }
  if (rest) parts.push(<MathText key={`t${key++}`} value={rest} />);

  return <>{parts}</>;
}

export default ColoredMathText;
