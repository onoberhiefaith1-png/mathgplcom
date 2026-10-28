// Engine B — Present Mode (manual presentation, fallback, student mode).
//
// This engine renders `LessonModel` through the previewChannel path.
// It MUST NOT import from the Floating engine, and vice versa. The
// only shared code is the board primitive + LessonModel.
//
// Contract:
//   - Display beats: nothing is written to the board; navigation-only.
//   - Solution beats: each preview click copies the corresponding
//     PresentationObject (chip / equation / note) verbatim onto the
//     board via the dumb primitive.
//   - Teacher notes preserve paragraph breaks (paragraphs[] flow via
//     planDirectWrite, which already treats blank-line-separated
//     paragraphs as separate rows).

import type { EditTarget } from "@/lib/smartboard/manualEdit/types";
import type { LessonModel } from "@/lib/smartboard/preview/model";
import { modelBeatFor, solutionLinesFor } from "@/lib/smartboard/preview/model";
import {
  previewWrite,
  type PreviewChannelHost,
} from "@/lib/smartboard/boardWriter/previewChannel";

export interface PresentEngineDeps {
  model: LessonModel;
  host: PreviewChannelHost;
}

/** One click on a Presenter Preview item → one deterministic board
 *  action. The engine consults the model to validate the target before
 *  delegating to the dumb primitive. */
export const presentModeClick = (deps: PresentEngineDeps, target: EditTarget): void => {
  // Validate that the target is authorised by the model. For solution
  // clicks the line must exist; for teacher notes the model must carry
  // a note for that line (purity law).
  if (target.beatId) {
    const mb = modelBeatFor(deps.model, target.beatId);
    if (mb.kind === "solution") {
      const idx = typeof target.lineIdx === "number" ? target.lineIdx : -1;
      if (target.kind === "teacher-note") {
        const line = solutionLinesFor(deps.model, target.beatId)[idx];
        if (!line?.note) return; // no note in model ⇒ no icon ⇒ no write
      }
    }
  }
  previewWrite(target, deps.host);
};
