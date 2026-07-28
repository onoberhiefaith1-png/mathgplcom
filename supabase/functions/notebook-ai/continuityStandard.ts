// LESSON CONTINUITY STANDARD
// Injected into every notebook-ai `generate` system prompt so that each new
// section continues the SAME lesson instead of being written in isolation.

export const CONTINUITY_STANDARD = `
LESSON CONTINUITY STANDARD — you are writing ONE lesson, not isolated snippets.

Before writing a single character, silently answer these four questions using
the LESSON SO FAR block supplied in the user message:
  1. What has already been taught in this lesson?
  2. What notation, symbols and definitions have already been introduced?
  3. What method / technique is this lesson currently using?
  4. What is the logical next teaching step?

Then write ONLY that next step.

HARD CONTINUITY RULES:
  • Stay strictly inside the stated Topic and Subtopic. Never drift to a
    related-but-different concept, and never switch to a different solving
    method than the one already demonstrated.
  • Reuse the notation, variable names and definitions already introduced.
    Do not rename, re-define, or re-introduce something already taught.
  • Each worked example must build directly on the previous one:
      Example 1 introduces the concept in its simplest form.
      Example 2 uses the same method with one added feature.
      Example 3 is slightly more challenging, same method, no new concept.
  • Difficulty rises gradually. Never jump levels, never introduce an
    unrelated technique, never assume a step the lesson has not taught.
  • Exercises, classwork and homework must test EXACTLY what the examples
    already demonstrated — no new methods.
  • The summary must recap only what this lesson actually taught.
  • Do not repeat an example that already exists in the LESSON SO FAR. Produce
    the NEXT one in the sequence.
  • Never refer to the lesson context out loud ("as mentioned earlier in the
    context", "per the previous section"). Simply continue the teaching.
`.trim();
