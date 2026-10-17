// Colour belongs to the geometry object, not to the formula.
//
// A property such as `BC^2 = CA^2 + AB^2` is rendered ONCE through the shared
// math renderer, but each geometry reference inside it is painted with the
// colour of the object it is bound to. References authored as `\georef{id}{label}`
// carry that binding structurally, so the colour follows the object even when
// the teacher renames the label. Plain-text token matching remains only as a
// fallback for properties authored before geometry-reference boxes existed.

import { useLayoutEffect, useRef } from "react";
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

/** Collect (label → colour) pairs from structural refs and token fallbacks. */
export function colourMarks(
  value: string,
  tokens: TokenColor[],
  colorForObject?: (objectId: string) => string | undefined,
  fallback?: string,
): TokenColor[] {
  const out: TokenColor[] = [];
  GEOREF.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GEOREF.exec(value)) !== null) {
    const color = colorForObject?.(m[1]) ?? fallback;
    const label = m[2].replace(/[{}\\]/g, "").trim();
    if (color && label) out.push({ token: label, color });
  }
  GEOREF.lastIndex = 0;
  const plain = stripGeoRefs(value);
  for (const t of tokens) if (t.token && plain.includes(t.token)) out.push(t);
  // Longest first so "BAC" wins over "BA".
  return out.sort((a, b) => b.token.length - a.token.length);
}

/**
 * The statement is drawn ONCE through the shared maths renderer, so fractions,
 * roots, powers and subscripts keep their full structure. Colour is applied
 * afterwards to the drawn text of each geometry reference — never by cutting
 * the formula into pieces (which broke fractions apart).
 */
export function ColoredMathText({
  value,
  tokens,
  colorForObject,
  fallbackColor,
}: {
  value: string;
  tokens: TokenColor[];
  colorForObject?: (objectId: string) => string | undefined;
  fallbackColor?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const marks = colourMarks(value ?? "", tokens, colorForObject, fallbackColor);
  const sig = marks.map((m) => m.token + ":" + m.color).join("|");
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || marks.length === 0) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const text = node.nodeValue ?? "";
      if (!text.trim()) continue;
      const frag = document.createDocumentFragment();
      let i = 0, buf = "", changed = false;
      while (i < text.length) {
        const hit = marks.find((mk) => text.startsWith(mk.token, i));
        if (hit) {
          if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ""; }
          const span = document.createElement("span");
          span.style.color = hit.color;
          span.textContent = hit.token;
          frag.appendChild(span);
          i += hit.token.length; changed = true;
        } else { buf += text[i]; i++; }
      }
      if (!changed) continue;
      if (buf) frag.appendChild(document.createTextNode(buf));
      node.parentNode?.replaceChild(frag, node);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, sig]);
  if (!value) return null;
  return <span ref={ref} key={value + sig}><MathText value={value} /></span>;
}

export default ColoredMathText;
