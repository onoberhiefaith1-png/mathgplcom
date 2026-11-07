import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { showsQuestionScreenFirst } from "../practiceEntry";

describe("Academia Practice opens on the Smartboard", () => {
  it("never shows the plain question screen for Academia Practice", () => {
    expect(showsQuestionScreenFirst({ mobile: true, boardOpen: false, academiaPractice: true })).toBe(false);
  });
  it("class assignments on phones/tablets keep their question screen", () => {
    expect(showsQuestionScreenFirst({ mobile: true, boardOpen: false, academiaPractice: false })).toBe(true);
    expect(showsQuestionScreenFirst({ mobile: false, boardOpen: false, academiaPractice: false })).toBe(false);
  });
  it("AssessmentBoardPage uses the rule and keeps Ask reachable on the board", () => {
    const src = readFileSync(resolve(__dirname, "../../../pages/student/AssessmentBoardPage.tsx"), "utf8");
    expect(src).toMatch(/showsQuestionScreenFirst\(\{ mobile, boardOpen, academiaPractice \}\)/);
    expect(src).toMatch(/mobile && academiaPractice && assessmentId && classId && !readOnly/);
  });
});
