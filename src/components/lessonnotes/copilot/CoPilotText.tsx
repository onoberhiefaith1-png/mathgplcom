// Co-Pilot chat text — rendered with the SAME classroom mathematics renderer
// the Lesson Note uses, so the draft the teacher reads in the chat shows
// A ∪ B, {1, 2, 3}, stacked fractions, roots, indices, Greek letters and
// matrices instead of raw markup. Nothing is stripped: it is parsed and drawn.

import { renderMathInline } from "@/lib/notebook/mathRender";
import { sanitizePresentation } from "@/lib/lessonnotes/outputHygiene";

export function CoPilotText({ text, className }: { text: string; className?: string }) {
  const clean = sanitizePresentation(String(text ?? ""));
  const lines = clean.split("\n");
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block">
          {line.trim() ? renderMathInline(line, `cp-${i}`) : "\u00a0"}
        </span>
      ))}
    </span>
  );
}

export default CoPilotText;
