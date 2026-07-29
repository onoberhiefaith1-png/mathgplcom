// Shared Smart Card renderer — used by the editor preview, the published
// card and the challenge header, so what the teacher styles is exactly what
// the audience sees.

import { graphemes, isEmoji, EMOJI_STYLE } from "@/lib/text/graphemes";
import PresenterMath, { toDisplaySafe } from "@/components/smartboard/PresenterMath";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import type { CardPresentation } from "@/lib/smartcards/smartCards";
import type { GeometryScene } from "@/lib/geometry/scene";

const BASE_FONT = 20;

/** Split a line into emoji runs and maths runs so each can scale on its own. */
function segments(line: string): { text: string; emoji: boolean }[] {
  const out: { text: string; emoji: boolean }[] = [];
  for (const g of graphemes(line)) {
    const emoji = isEmoji(g);
    const last = out[out.length - 1];
    if (last && last.emoji === emoji) last.text += g;
    else out.push({ text: g, emoji });
  }
  return out;
}

interface Props {
  presentation: CardPresentation;
  scenes?: GeometryScene[];
  title?: string;
  className?: string;
}

export const SmartCardQuestion = ({ presentation: p, scenes = [], className = "" }: Props) => {
  const fontSize = BASE_FONT * (p.fontScale || 1);
  const lines = (p.questionText || "").split("\n");
  return (
    <div
      className={className}
      style={{
        textAlign: p.align,
        fontWeight: p.bold ? 700 : 400,
        fontStyle: p.italic ? "italic" : "normal",
        textDecoration: p.underline ? "underline" : "none",
        color: p.color,
      }}
    >
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <div key={`sp-${i}`} style={{ height: fontSize * 0.6 }} />
        ) : (
          <div key={`ln-${i}`} className="leading-relaxed" style={{ fontSize }}>
            {segments(line).map((seg, j) =>
              seg.emoji ? (
                // Emoji identity: native colour always, size only ever scales.
                <span
                  key={`e-${i}-${j}`}
                  style={{ ...EMOJI_STYLE, fontSize: fontSize * (p.emojiScale || 1) }}
                >
                  {seg.text}
                </span>
              ) : (
                <PresenterMath
                  key={`m-${i}-${j}`}
                  ascii={toDisplaySafe(seg.text)}
                  keyBase={`card-${i}-${j}`}
                  color={p.color}
                  className="font-serif"
                />
              ),
            )}
          </div>
        ),
      )}
      {scenes.length > 0 && (
        <div className="mt-4 flex flex-col items-center gap-4">
          {scenes.map((scene, i) => (
            <div
              key={`geo-${i}`}
              style={{
                transform: `translate(${p.diagramOffsetX}px, ${p.diagramOffsetY}px) scale(${p.diagramScale || 1})`,
                transformOrigin: "center top",
              }}
            >
              <GeometryDiagram scene={scene} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmartCardQuestion;
