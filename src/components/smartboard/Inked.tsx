// Inked — wraps plain text in per-character spans with deterministic micro
// jitter (weight, opacity, vertical nudge). Simulates pen pressure variance.
// Skip-renders math children; only direct string children are split.
//
// EMOJI IDENTITY: text is split by GRAPHEME, never by code point, so an
// emoji (with its variation selector / ZWJ / skin tone) stays one unit and
// keeps its native colour font. Emoji never receive ink jitter, opacity or
// weight — only size is inherited.

import { ReactNode, useMemo } from "react";
import { EMOJI_STYLE, graphemes, isEmoji } from "@/lib/text/graphemes";

interface Props {
  children: string;
  /** 0..1 — typically passed from the active writing profile. */
  jitter?: number;
  /** Stable seed so re-renders don't reshuffle. */
  seed?: number;
}

// Tiny deterministic PRNG (mulberry32).
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const Inked = ({ children, jitter = 0.08, seed = 1 }: Props): ReactNode => {
  const chars = useMemo(() => {
    const rng = mulberry32(seed + children.length * 31);
    return graphemes(children).map((ch, i) => {
      if (ch === " " || ch === "\n") return { ch, w: 0, o: 1, y: 0, key: i, emoji: false };
      if (isEmoji(ch)) return { ch, w: 1, o: 1, y: 0, key: i, emoji: true };
      const w = 1 - jitter * 0.5 + rng() * jitter;          // 1±jitter/2
      const o = 1 - rng() * jitter * 0.6;                   // 1 .. 1-jit*0.6
      const y = (rng() - 0.5) * jitter * 1.4;               // px-ish em offset
      return { ch, w, o, y, key: i, emoji: false };
    });
  }, [children, jitter, seed]);


  return (
    <>
      {chars.map(({ ch, w, o, y, key, emoji }) =>
        ch === " " ? (
          <span key={key}> </span>
        ) : ch === "\n" ? (
          <br key={key} />
        ) : emoji ? (
          <span key={key} style={{ display: "inline-block", ...EMOJI_STYLE }}>
            {ch}
          </span>
        ) : (
          <span
            key={key}
            style={{
              display: "inline-block",
              fontWeight: "inherit",
              opacity: o,
              transform: `translateY(${y * 0.06}em) scale(${0.985 + w * 0.03})`,
            }}
          >
            {ch}
          </span>
        ),
      )}
    </>
  );
};

export default Inked;
