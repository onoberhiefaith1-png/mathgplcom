import { describe, expect, it } from "vitest";

import { MODEL_LESSON_NOTE, EDITOR_NODES } from "../knowledge/editor";
import { KNOWLEDGE_IDS } from "../knowledge";
import { buildAgentSystemPrompt } from "../systemPrompt";
import {
  PRACTICE_PREFIX,
  STUDY_TOOL_IDS,
  isPracticeTitle,
  isStudyTool,
  isStudyWrite,
  practiceTitle,
} from "../studyPolicy";

describe("the model lesson note", () => {
  it("shows the Solution heading with its two links", () => {
    expect(MODEL_LESSON_NOTE).toContain("Solution");
    expect(MODEL_LESSON_NOTE).toContain("[Floating Number]");
    expect(MODEL_LESSON_NOTE).toContain("[Assign]");
  });

  it("forbids the labels that broke the page before", () => {
    expect(MODEL_LESSON_NOTE).toContain('"Problem:"');
    expect(MODEL_LESSON_NOTE).toContain("Line 1:");
    expect(MODEL_LESSON_NOTE).toContain("Example: Example 1");
  });

  it("travels with every turn", () => {
    expect(buildAgentSystemPrompt()).toContain("WHAT A FINISHED LESSON NOTE LOOKS LIKE");
  });

  it("registers the page, toolbar, asset and emoji knowledge", () => {
    for (const node of EDITOR_NODES) expect(KNOWLEDGE_IDS).toContain(node.id);
    expect(KNOWLEDGE_IDS).toContain("lesson-note-toolbar");
  });
});

describe("the study fence", () => {
  it("never lets a study run reach a student", () => {
    for (const blocked of [
      "assign_question",
      "archive_lesson_note",
      "delete_lesson_content",
      "restore_lesson_note",
      "remove_student_from_class",
      "create_class",
      "link_lesson_note_to_class",
      "link_game_to_class",
    ]) {
      expect(isStudyTool(blocked)).toBe(false);
      expect(STUDY_TOOL_IDS).not.toContain(blocked);
    }
  });

  it("allows reading and practice writing", () => {
    expect(isStudyTool("read_lesson_note")).toBe(true);
    expect(isStudyWrite("write_question")).toBe(true);
    expect(isStudyWrite("read_lesson_note")).toBe(false);
  });

  it("marks her own notebooks and recognises them again", () => {
    const title = practiceTitle("quadratic equations");
    expect(title.startsWith(PRACTICE_PREFIX)).toBe(true);
    expect(isPracticeTitle(title)).toBe(true);
    expect(isPracticeTitle("Complex Numbers")).toBe(false);
  });
});
