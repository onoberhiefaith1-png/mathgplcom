// Colour belongs to the geometry object, not to the formula.
//
// A property such as `BC^2 = CA^2 + AB^2` is rendered ONCE through the shared
// math renderer, but each geometry reference inside it is painted with the
// colour of the object it is bound to. References authored as `\georef{id}{label}`
// carry that binding structurally, so the colour follows the object even when
// the teacher renames the label. Plain-text token matching remains only as a
// fallback for properties authored before geometry-reference boxes existed.

import type { ReactNode } from "react";
import { MathText } from "@/lib/geometry/map/renderStatement";

export interface TokenColor {
  token: string;
  color: string;
}

const GEOREF = /\\georef\{([^}]*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g;

/** Strip geometry-reference macros down to their labels (for plain contexts). */
export function stripGeoRefs(value: string): string {
  return value.replace(GEOREF, (_m, _id, label) => label);
}

function renderWithGeoRefs(
  value: string,
  colorForObject: (objectId: string) => string | undefined,
  fallback: string | undefined,
): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  GEOREF.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GEOREF.exec(value)) !== null) {
    if (m.index > last) {
      parts.push(<MathText key={`t${key++}`} value={value.slice(last, m.index)} />);
    }
    const color = colorForObject(m[1]) ?? fallback;
    parts.push(
      <span key={`g${key++}`} style={color ? { color } : undefined}>
        <MathText value={m[2]} />
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < value.length) {
    parts.push(<MathText key={`t${key++}`} value={value.slice(last)} />);
  }
  return parts;
}

/**
 * Splits the statement on its geometry references and paints each reference
 * with its object colour. Anything that is not a reference keeps the ink
 * colour of the surrounding text, so the formula is never one flat colour.
 */
export function ColoredMathText({
  value,
  tokens,
  colorForObject,
  fallbackColor,
}: {
  value: string;
  tokens: TokenColor[];
  /** Colour of a geometry object, resolved by its stable id. */
  colorForObject?: (objectId: string) => string | undefined;
  /** Colour for a reference whose object has no colour yet. */
  fallbackColor?: string;
}) {
  if (!value) return null;

  // Structural references win: identity, not wording, decides the colour.
  if (GEOREF.test(value)) {
    GEOREF.lastIndex = 0;
    const byId = colorForObject ?? (() => undefined);
    return <>{renderWithGeoRefs(value, byId, fallbackColor)}</>;
  }

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
