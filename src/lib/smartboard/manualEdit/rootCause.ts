// Manual AI Edit — deterministic root cause classifier.
// Given the target and pre/post probes, decide why the board doesn't
// match the Preview.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, RootCause } from "./types";
import {
  probeActiveLine,
  probeFloating,
  probeLine,
  probeNote,
  probeOverlap,
  probeScroll,
} from "./probes";

export interface Diagnosis {
  cause: RootCause;
  detail: string;
}

export const diagnose = (
  ctrl: PresentationController,
  target: EditTarget,
): Diagnosis => {
  const lineIdx = typeof target.lineIdx === "number" ? target.lineIdx : -1;

  // Scroll first — nothing else matters if the row is off-screen.
  const scroll = probeScroll(ctrl, target);
  if (!scroll.inView) return { cause: "outside-viewport", detail: "Preview card off-screen." };

  if (lineIdx < 0) {
    return { cause: "mapping-missing", detail: "Target has no line index." };
  }

  const active = probeActiveLine(ctrl, lineIdx);

  switch (target.kind) {
    case "teacher-note": {
      const n = probeNote(ctrl, lineIdx);
      if (!n.inPreview) return { cause: "structural", detail: "Preview has no note for this line." };
      if (!n.onBoard) {
        if (!active.matches) return { cause: "active-line-drift", detail: `Active line was ${active.active + 1}.` };
        return { cause: "render-empty", detail: "Note exists in Preview but nothing on the board." };
      }
      return { cause: "none", detail: "Note already on board." };
    }
    case "floating-number": {
      const fillerIdx = typeof target.fillerIdx === "number" ? target.fillerIdx : 0;
      const f = probeFloating(ctrl, lineIdx, fillerIdx);
      if (f.matches) return { cause: "none", detail: "Chip already present." };
      if (!f.panelOpen) return { cause: "panel-did-not-open", detail: "# panel closed." };
      const overlap = probeOverlap(ctrl, lineIdx);
      if (overlap.overlaps) return { cause: "blocked-by-overlap", detail: `Overlaps line ${(overlap.with ?? 0) + 1}.` };
      return { cause: "chip-not-registered", detail: "Chip click did not land." };
    }
    case "solution-line":
    case "question":
    case "math-structure": {
      const l = probeLine(ctrl, lineIdx);
      if (l.matches) return { cause: "none", detail: "Line already matches." };
      const overlap = probeOverlap(ctrl, lineIdx);
      if (overlap.overlaps) return { cause: "blocked-by-overlap", detail: `Overlaps line ${(overlap.with ?? 0) + 1}.` };
      if (!l.hasLine) return { cause: "queue-missed", detail: "Row is empty on the board." };
      if (!active.matches) return { cause: "active-line-drift", detail: `Active line was ${active.active + 1}.` };
      return { cause: "render-empty", detail: "Line partially rendered." };
    }
    default:
      return { cause: "mapping-missing", detail: "Target kind not addressable." };
  }
};
