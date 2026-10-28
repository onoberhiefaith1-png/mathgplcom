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
        else if (field === "id" || field === "title" || field === "entryPath")
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

  it("never offers a step in words the app does not use", () => {
    // "Quiz" is not a MathGPL word: it may only appear where we say so.
    const offered = KNOWLEDGE_NODES.flatMap((n) => [
      n.title,
      n.firstStep,
      n.onSave,
      ...n.actions,
      ...n.inputs,
      ...n.nextSteps,
    ])
      .join(" ")
      .toLowerCase();
    expect(offered).not.toContain("quiz");
    expect(NAMING_TRUTHS.toLowerCase()).toContain('"quiz" does not exist');
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

describe("Aura knows how a lesson note is really built", () => {
  it("treats every question as a session the board can step through", () => {
    const sections = findKnowledge("lesson-sections")!;
    expect(sections.purpose.toLowerCase()).toContain("session");
    expect(sections.pitfalls.join(" ").toLowerCase()).toContain("own session");
    expect(NAMING_TRUTHS.toLowerCase()).toContain("session by session");
    expect(AGENT_TOOL_IDS).toContain("add_lesson_session");
  });

  it("carries both Floating Number stages and the dry run", () => {
    const prep = findKnowledge("floating-preparation")!;
    expect(prep.entryPath).toContain("floating-prep");
    expect(prep.firstStep.toLowerCase()).toContain("floating");
    const gen = findKnowledge("floating-numbers")!;
    expect(gen.actions.join(" ")).toContain("Generate");
    expect(gen.actions.join(" ")).toContain("Shuffle");
    const test = findKnowledge("floating-test")!;
    expect(test.entryPath).toContain("/test");
    expect(test.onSave.toLowerCase()).toContain("nothing is saved");
  });

  it("never offers a spacing setting that does not exist", () => {
    const all = KNOWLEDGE_NODES.flatMap((n) => [...n.actions, ...n.inputs]).join(" ").toLowerCase();
    expect(all).not.toContain("scattered");
    expect(all).not.toContain("tight");
    expect(NAMING_TRUTHS.toLowerCase()).toContain('no "tight" or "scattered"');
  });

  it("selects the right workflows on each floating page", () => {
    expect(knowledgeForPath("/lesson-notes/a/floating-prep/b")).toContain("floating-preparation");
    expect(knowledgeForPath("/lesson-notes/a/floating/b")).toContain("floating-numbers");
    expect(knowledgeForPath("/lesson-notes/a/floating/b/test")).toContain("floating-test");
  });

  it("puts the authoring order into the system prompt", () => {
    const prompt = buildAgentSystemPrompt(undefined, { path: "/lesson-notes/1" });
    expect(prompt).toContain("WRITING A LESSON NOTE — THE ORDER NEVER CHANGES");
    expect(prompt).toContain("Test on Smartboard");
    expect(prompt).toContain("TEACHING OUT LOUD");
  });
});
