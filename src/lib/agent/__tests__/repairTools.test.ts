import { describe, expect, it } from "vitest";

import { findAgentTool } from "../toolTypes";
import { executeAgentTool } from "../tools.server";
import { buildAgentSystemPrompt } from "../systemPrompt";

const ctx = { supabase: {} as never, userId: "teacher-1" };

describe("lesson-note repair abilities", () => {
  it("can read a note's structure without changing it", () => {
    expect(findAgentTool("inspect_lesson_note")?.readOnly).toBe(true);
    expect(findAgentTool("preview_removal")?.readOnly).toBe(true);
    expect(findAgentTool("inspect_board_state")?.readOnly).toBe(true);
  });

  it("never removes or restores on its own word", async () => {
    for (const id of ["delete_lesson_content", "restore_lesson_note"]) {
      expect(findAgentTool(id)?.needsConfirmation).toBe(true);
      const blocked = await executeAgentTool(ctx, id, { notebookId: "n1", blockIds: ["b1"] });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.error).toContain("confirmation");
    }
  });

  it("asks for the missing piece instead of guessing", async () => {
    const noTarget = await executeAgentTool(ctx, "edit_lesson_text", {});
    expect(noTarget.ok).toBe(false);
    const noScope = await executeAgentTool(ctx, "reorder_lesson", { orderedIds: ["a", "b"] });
    expect(noScope.ok).toBe(false);
    const noMove = await executeAgentTool(ctx, "move_lesson_lines", {});
    expect(noMove.ok).toBe(false);
  });

  it("tells her to repair rather than append a corrected copy", () => {
    const prompt = buildAgentSystemPrompt();
    expect(prompt).toContain("promote_to_session");
    expect(prompt).toContain("snapshot_lesson_note");
    expect(prompt).toContain("preview_removal");
    expect(prompt).toContain("Moving never rewrites mathematics");
  });
});
