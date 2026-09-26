import { describe, expect, it } from "vitest";

import { lessonNoteTrainingBlocks, lessonNoteTrainingPrompt } from "../lessonKnowledge";
import { buildAgentSystemPrompt } from "../systemPrompt";
import { AGENT_TOOL_MANIFEST } from "../toolTypes";
import { agentExecutorIds } from "../tools.server";

describe("the Co-Pilot's training, shared with Aura", () => {
  it("carries every lesson-note standard", () => {
    const blocks = lessonNoteTrainingBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(9);
    const all = blocks.join("\n");
    expect(all).toContain("MASTER PEDAGOGICAL REFERENCE");
    expect(all).toContain("MATHGPL CO-PILOT PROFESSIONAL STANDARD");
  });

  it("is inside Aura's briefing", () => {
    const prompt = buildAgentSystemPrompt();
    expect(prompt).toContain("THE MATHGPL LESSON-NOTE TRAINING");
    expect(prompt).toContain("MASTER PEDAGOGICAL REFERENCE");
    expect(prompt).toContain("generate_lesson_content");
    expect(lessonNoteTrainingPrompt().length).toBeGreaterThan(2000);
  });

  it("gives her the generator, the plan and the review as real abilities", () => {
    const ids = AGENT_TOOL_MANIFEST.map((t) => t.id);
    for (const id of ["plan_lesson_note", "generate_lesson_content", "review_lesson_section"]) {
      expect(ids).toContain(id);
      expect(agentExecutorIds()).toContain(id);
    }
  });
});
