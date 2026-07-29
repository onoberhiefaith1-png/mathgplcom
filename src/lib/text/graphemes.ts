// Grapheme-safe text utilities.
//
// An emoji is an IDENTITY token, exactly like a variable. Every maths
// pipeline in this app used to walk strings one UTF-16 code unit at a time
// (`src[i]`), which slices an emoji surrogate pair in half and renders two
// U+FFFD replacement characters ("?" diamonds). These helpers are the single
// authority for splitting text into user-perceived characters so an emoji is
// always exactly ONE character node / ONE token.

import type { CSSProperties } from "react";

const REPLACEMENT = "\uFFFD";

interface GraphemeSegmenter {
  segment: (input: string) => Iterable<{ segment: string }>;
}

let segmenter: GraphemeSegmenter | null = null;
try {
  // Not available on very old runtimes; the fallback below covers them.
  const Ctor = (Intl as unknown as {
    Segmenter?: new (l?: string, o?: { granularity: string }) => GraphemeSegmenter;
  }).Segmenter;
  segmenter = Ctor ? new Ctor(undefined, { granularity: "grapheme" }) : null;
} catch {
  segmenter = null;
}

/** Splits text into user-perceived characters. Emoji, skin-tone modifiers,
 *  ZWJ sequences, variation selectors, keycaps and flags stay whole. */
export function graphemes(s: string): string[] {
  if (!s) return [];
  if (segmenter) return Array.from(segmenter.segment(s), (g) => g.segment);
  // Fallback: code points, then glue combining/ZWJ/modifier sequences.
  const cps = [...s];
  const out: string[] = [];
  for (const cp of cps) {
    const prev = out[out.length - 1];
    const code = cp.codePointAt(0) ?? 0;
    const isJoiner =
      code === 0x200d ||                       // ZWJ
      (code >= 0xfe00 && code <= 0xfe0f) ||    // variation selectors
      (code >= 0x1f3fb && code <= 0x1f3ff) ||  // skin tones
      (code >= 0x20d0 && code <= 0x20ff) ||    // combining marks
      code === 0x20e3;                         // keycap
    const prevJoins = !!prev && prev.codePointAt(prev.length - 1) === 0x200d;
    if (prev && (isJoiner || prevJoins)) out[out.length - 1] = prev + cp;
    else out.push(cp);
  }
  return out;
}

/** True when the grapheme is pictographic (emoji), not mathematics. */
export function isEmoji(g: string): boolean {
  if (!g) return false;
  try {
    return /\p{Extended_Pictographic}/u.test(g);
  } catch {
    const c = g.codePointAt(0) ?? 0;
    return (
      (c >= 0x1f000 && c <= 0x1faff) ||
      (c >= 0x2600 && c <= 0x27bf) ||
      (c >= 0x2190 && c <= 0x21ff && g.includes("\uFE0F")) ||
      c === 0x2b50 || c === 0x2b55
    );
  }
}

/** True when the string contains at least one emoji. */
export const hasEmoji = (s: string): boolean => graphemes(s).some(isEmoji);

/** Removes lone surrogates + replacement characters left behind by any code
 *  that sliced a string by UTF-16 unit. Prevents the "?" diamond from ever
 *  reaching the screen. */
export const stripBrokenGlyphs = (s: string): string =>
  s ? s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|\uFFFD/g, "") : s;

/** True when the string carries a broken-glyph replacement character. */
export const hasBrokenGlyph = (s: string): boolean => s.includes(REPLACEMENT);

/** Inline style that pins an emoji to its own identity: the system colour
 *  emoji font, never the ink colour / ink filter. Only SIZE inherits. */
export const EMOJI_STYLE: CSSProperties = {
  fontFamily:
    '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Android Emoji","EmojiSymbols",sans-serif',
  color: "initial",
  WebkitTextFillColor: "initial",
  filter: "none",
  mixBlendMode: "normal",
  fontSize: "1em",
  fontStyle: "normal",
  fontWeight: 400,
  textShadow: "none",
  WebkitTextStroke: "0",
} as CSSProperties;
