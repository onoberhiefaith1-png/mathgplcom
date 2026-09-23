import { describe, expect, it } from "vitest";
import { readdirSync, existsSync } from "node:fs";

import {
  KNOWLEDGE_NODES,
  KNOWLEDGE_IDS,
  findKnowledge,
  knowledgeIndexPrompt,
  knowledgeDetailPrompt,
  NAMING_TRUTHS,
  REQUIRED_NODE_FIELDS,
} from "../knowledge";
import { knowledgeForPath } from "../knowledge/select";
import { buildAgentSystemPrompt } from "../systemPrompt";
import { AGENT_TOOL_IDS } from "../toolTypes";

const routeRoots = existsSync("src/routes")
  ? new Set(readdirSync("src/routes").map((name) => name.replace(/\.tsx?$/, "")))
  : new Set<string>();

describe("Aura's operational map", () => {
  it("documents every workflow completely — no half-written node", () => {
    expect(KNOWLEDGE_NODES.length).toBeGreaterThanOrEqual(18);
    for (const node of KNOWLEDGE_NODES) {
      for (const field of REQUIRED_NODE_FIELDS) {
        const value = node[field];
        if (Array.isArray(value)) expect(value.length, `${node.id}.${field}`).toBeGreaterThan(0);
        else if (field === "id" || field === "title")
          expect(String(value).trim().length, `${node.id}.${field}`).toBeGreaterThan(3);
        else expect(String(value).trim().length, `${node.id}.${field}`).toBeGreaterThan(10);
      }
    }
  });

  it("has unique ids and only points at workflows that exist", () => {
    expect(new Set(KNOWLEDGE_IDS).size).toBe(KNOWLEDGE_IDS.length);
    for (const node of KNOWLEDGE_NODES) {
      for (const id of node.connectedTo) {
        expect(findKnowledge(id), `${node.id} → ${id}`).toBeTruthy();
      }
    }
  });

  it("starts every workflow at a real page in this app", () => {
    for (const node of KNOWLEDGE_NODES) {
      expect(node.entryPath.startsWith("/"), node.id).toBe(true);
      const first = node.entryPath.split("/")[1] ?? "";
      expect(routeRoots.has(first), `${node.id} → /${first}`).toBe(true);
    }
  });

  it("never uses a word the app does not use", () => {
    const text = KNOWLEDGE_NODES.map((n) => JSON.stringify(n)).join(" ").toLowerCase();
    // "Quiz" does not exist in MathGPL — except where we warn against it.
    const quizzes = text.match(/quiz/g) ?? [];
    const warnings = KNOWLEDGE_NODES.flatMap((n) => n.pitfalls)
      .join(" ")
      .toLowerCase()
      .match(/quiz/g) ?? [];
    expect(quizzes.length).toBe(warnings.length);
  });

  it("knows the three meanings of a session and never invents a fourth", () => {
    const sections = findKnowledge("lesson-sections")!;
    const pitfalls = sections.pitfalls.join(" ").toLowerCase();
    expect(pitfalls).toContain("session");
    expect(NAMING_TRUTHS.toLowerCase()).toContain("live teaching room");
    expect(findKnowledge("live")!.entryPath).toContain("/live");
  });

  it("ties Floating Numbers to highlighting a written solution", () => {
    const floating = findKnowledge("floating-numbers")!;
    expect(floating.purpose.toLowerCase()).toContain("highlight");
    expect(floating.connectedTo).toContain("lesson-notes");
  });
});

describe("choosing what to say for the screen in play", () => {
  it("brings the lesson-note workflows to a lesson-note page", () => {
    const ids = knowledgeForPath("/lesson-notes/abc");
    expect(ids).toContain("lesson-notes");
    expect(ids).toContain("lesson-sections");
    expect(ids).toContain("floating-numbers");
  });

  it("brings Floating Numbers first on the floating page", () => {
    expect(knowledgeForPath("/lesson-notes/abc/floating/xyz")).toContain("floating-numbers");
  });

  it("brings the board on a class Smartboard, and the game in the game editor", () => {
    expect(knowledgeForPath("/teaching-hub/classes/1/smartboard")).toContain("smartboard");
    expect(knowledgeForPath("/game/slate/9")).toContain("slate-game");
    expect(knowledgeForPath("/adventure/games/3")).toContain("adventures");
    expect(knowledgeForPath("/community")).toContain("community");
  });

  it("always knows something, even on a page it has no rule for", () => {
    expect(knowledgeForPath("/somewhere-new").length).toBeGreaterThan(0);
  });

  it("writes out only the chosen workflows, but indexes all of them", () => {
    const index = knowledgeIndexPrompt();
    for (const id of KNOWLEDGE_IDS) expect(index).toContain(`[${id}]`);
    const detail = knowledgeDetailPrompt(["classes"]);
    expect(detail).toContain("[classes]");
    expect(detail).not.toContain("[adventures]");
  });
});

describe("the system prompt keeps its non-negotiables", () => {
  const prompt = buildAgentSystemPrompt(undefined, { path: "/lesson-notes/1" });

  it("still carries the mathematics, safety and voice rules word for word", () => {
    expect(prompt).toContain("MATHEMATICS — NON-NEGOTIABLE");
    expect(prompt).toContain("QUESTION_LOCK");
    expect(prompt).toContain("One micro-step per line, classroom whiteboard style.");
    expect(prompt).toContain("SAFETY");
    expect(prompt).toContain("confirmed set to true");
    expect(prompt).toContain("VOICE");
  });

  it("now carries where the teacher is, the whole map, and the knowing/doing line", () => {
    expect(prompt).toContain("WHERE THE TEACHER IS RIGHT NOW");
    expect(prompt).toContain("/lesson-notes/1");
    expect(prompt).toContain("HOW MATHGPL WORKS — EVERY WORKFLOW");
    expect(prompt).toContain("ALWAYS BE ONE STEP AHEAD");
    expect(prompt).toContain("KNOWING AND DOING ARE DIFFERENT");
  });

  it("can look a workflow up before guiding a teacher", () => {
    expect(AGENT_TOOL_IDS).toContain("explain_workflow");
  });

  it("still works before any screen has reported anything", () => {
    const bare = buildAgentSystemPrompt();
    expect(bare).not.toContain("WHERE THE TEACHER IS RIGHT NOW");
    expect(bare).toContain("HOW MATHGPL WORKS — EVERY WORKFLOW");
  });
});
