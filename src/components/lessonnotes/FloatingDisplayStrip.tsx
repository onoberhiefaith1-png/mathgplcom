// FloatingDisplayStrip — embedded preview of the Smartboard's floating
// number carrier. Shows 5 fragments at a time and loops continuously via
// ◀ / ▶. No drag, no resize, no elevator, no insertion side effects.

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { extractTermsFromAscii, renderTermLabel } from "@/lib/smartboard/floatingExtractor";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";

const WINDOW_SIZE = 5;

interface Props {
  tokens: string[];
  selected?: boolean[];
}

export const FloatingDisplayStrip = ({ tokens, selected }: Props) => {
  const [cursor, setCursor] = useState(0);

  // Keep cursor in range when token list changes.
  useEffect(() => {
    if (tokens.length === 0) setCursor(0);
    else if (cursor >= tokens.length) setCursor(0);
  }, [tokens.length, cursor]);

  const windowed = useMemo(() => {
    if (tokens.length === 0) return [] as { token: string; absIdx: number }[];
    const n = Math.min(WINDOW_SIZE, tokens.length);
    const len = tokens.length;
    const out: { token: string; absIdx: number }[] = [];
    for (let i = 0; i < n; i++) {
      const idx = (((cursor + i) % len) + len) % len;
      out.push({ token: tokens[idx], absIdx: idx });
    }
    return out;
  }, [tokens, cursor]);

  const goLeft = () => {
    if (tokens.length === 0) return;
    setCursor((c) => ((c - 1) % tokens.length + tokens.length) % tokens.length);
  };
  const goRight = () => {
    if (tokens.length === 0) return;
    setCursor((c) => ((c + 1) % tokens.length + tokens.length) % tokens.length);
  };

  return (
    <div className="mt-5">
      <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/55 mb-2">
        Smartboard Preview · 5 at a time
      </div>
      <div className="flex items-stretch gap-2">
        <button
          onClick={goLeft}
          aria-label="scroll left"
          disabled={tokens.length === 0}
          className="grid place-items-center rounded-xl border disabled:opacity-30"
          style={{
            width: 44,
            background: "hsl(38 38% 96%)",
            borderColor: "hsl(220 35% 18% / 0.35)",
            color: "hsl(220 35% 18%)",
          }}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div
          className="flex-1 rounded-xl flex items-center justify-center gap-2 px-3 select-none"
          style={{
            minHeight: 64,
            background: "hsl(38 38% 96%)",
            border: "1.5px dashed hsl(220 35% 18% / 0.35)",
            color: "hsl(220 35% 18%)",
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: 20,
          }}
        >
          {windowed.length === 0 ? (
            <span className="text-[12px] italic opacity-50" style={{ fontFamily: "inherit" }}>
              empty — generate floating numbers above
            </span>
          ) : (
            windowed.map(({ token, absIdx }, i) => {
              const cleaned = toUnicodeMath(token);
              if (isStillDirty(cleaned)) return null;
              const term = extractTermsFromAscii(cleaned)[0];
              const label = term
                ? renderTermLabel(term, { isFirst: false, prevWasEquals: false })
                : cleaned;
              const isSel = !!selected?.[absIdx];
              return (
                <span
                  key={`${absIdx}-${i}`}
                  className="px-3 py-1 rounded-lg"
                  style={isSel ? {
                    background: "hsl(48 95% 68%)",
                    border: "1.5px solid hsl(40 85% 42%)",
                  } : { background: "transparent" }}
                >
                  {label}
                </span>
              );
            })
          )}
        </div>

        <button
          onClick={goRight}
          aria-label="scroll right"
          disabled={tokens.length === 0}
          className="grid place-items-center rounded-xl border disabled:opacity-30"
          style={{
            width: 44,
            background: "hsl(38 38% 96%)",
            borderColor: "hsl(220 35% 18% / 0.35)",
            color: "hsl(220 35% 18%)",
          }}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default FloatingDisplayStrip;
