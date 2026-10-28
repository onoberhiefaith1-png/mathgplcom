import { describe, expect, it } from "vitest";

import { AGENT_TOOL_IDS, AGENT_TOOL_MANIFEST, agentManifestPrompt, findAgentTool } from "../toolTypes";
import { agentExecutorIds, executeAgentTool } from "../tools.server";

const ctx = { supabase: {} as never, userId: "teacher-1" };

describe("agent tool bridge", () => {
  it("has a unique id for every tool", () => {
    expect(new Set(AGENT_TOOL_IDS).size).toBe(AGENT_TOOL_IDS.length);
  });

  it("has an executor for every manifest tool and no orphan executors", () => {
    expect([...agentExecutorIds()].sort()).toEqual([...AGENT_TOOL_IDS].sort());
  });

  it("describes every tool and argument in the prompt manifest", () => {
    const prompt = agentManifestPrompt();
    for (const tool of AGENT_TOOL_MANIFEST) {
      expect(prompt).toContain(tool.id);
      for (const param of tool.params) expect(prompt).toContain(param.name);
    }
  });

  it("rejects an unknown tool instead of throwing", async () => {
    const result = await executeAgentTool(ctx, "not_a_tool");
    expect(result).toEqual({ ok: false, toolId: "not_a_tool", error: 'Unknown tool "not_a_tool".' });
  });

  it("reports missing required arguments back to the agent", async () => {
    const result = await executeAgentTool(ctx, "read_lesson_note", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("notebookId");
  });

  it("navigates only to in-app paths", async () => {
    const ok = await executeAgentTool(ctx, "navigate", { path: "/teaching-hub/classes" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.navigateTo).toBe("/teaching-hub/classes");

    for (const path of ["https://evil.example", "//evil.example", "teaching-hub"]) {
      const bad = await executeAgentTool(ctx, "navigate", { path });
      expect(bad.ok).toBe(false);
    }
  });

  it("marks read-only tools as safe and keeps destructive flags explicit", () => {
    expect(findAgentTool("workspace_snapshot")?.readOnly).toBe(true);
    expect(findAgentTool("create_class")?.readOnly).toBe(false);
    expect(AGENT_TOOL_MANIFEST.every((t) => typeof t.needsConfirmation === "boolean")).toBe(true);
  });
});
