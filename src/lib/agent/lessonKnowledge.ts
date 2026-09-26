// The Co-Pilot's lesson-note training, shared with Aura.
//
// Nothing is rewritten here. This module re-uses the SAME standard strings the
// lesson-note Co-Pilot reads, so editing a standard updates both AIs at once.
// The standards are plain strings with no runtime dependencies, which is why
// they are safe to import into the app bundle.

import { PEDAGOGY_REFERENCE } from "../../../supabase/functions/notebook-ai/pedagogyReference.ts";
import { solutionKnowledgeBlocks } from "../../../supabase/functions/notebook-ai/sharedKnowledge.ts";

export { PEDAGOGY_REFERENCE };

/** Every standard that governs a professional MathGPL lesson note. */
export function lessonNoteTrainingBlocks(): string[] {
  return solutionKnowledgeBlocks(PEDAGOGY_REFERENCE);
}

/** The whole training, written for Aura's briefing. */
export function lessonNoteTrainingPrompt(): string {
  return [
    `THE MATHGPL LESSON-NOTE TRAINING (the same standards the lesson-note Co-Pilot
works to). These are not suggestions. Anything you write into a lesson note, any
line you correct, and anything you teach aloud obeys them exactly. When a
standard and your own instinct disagree, the standard wins.`,
    ...lessonNoteTrainingBlocks(),
  ].join("\n\n");
}
