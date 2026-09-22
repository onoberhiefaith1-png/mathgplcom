import { describe, expect, it } from "vitest";

import { buildAgentSystemPrompt, AGENT_GREETING_INSTRUCTION } from "../systemPrompt";
import { AGENT_TOOL_IDS } from "../toolTypes";

describe("agent system prompt", () => {
  const prompt = buildAgentSystemPrompt({ displayName: "Faith", workspaceName: "MathGPL" });

  it("lists every platform tool the bridge exposes", () => {
    for (const id of AGENT_TOOL_IDS) expect(prompt).toContain(id);
  });

  it("carries the non-negotiable mathematics rules", () => {
    expect(prompt).toContain("QUESTION_LOCK");
    expect(prompt).toContain("One micro-step per line");
    expect(prompt).toMatch(/Unicode/);
  });

  it("personalises from the workspace snapshot hint", () => {
    expect(prompt).toContain("Faith");
    expect(prompt).toContain("MathGPL");
    expect(buildAgentSystemPrompt()).not.toContain("Faith");
  });

  it("asks the greeting to stay short and offer to act", () => {
    expect(AGENT_GREETING_INSTRUCTION).toMatch(/two sentences/);
  });
});
