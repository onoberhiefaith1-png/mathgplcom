import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  "src/pages/quickIssues/QuickIssueTrackerPage.tsx",
  "utf8",
);
const list = readFileSync("src/pages/quickIssues/IssueList.tsx", "utf8");
const card = readFileSync("src/pages/staffHub/QuickIssueCard.tsx", "utf8");

describe("tracker wording", () => {
  it("does not call the completion attachment proof", () => {
    const text = `${page}\n${list}\n${card}`.toLowerCase();
    expect(text).not.toContain("proof");
    expect(list).toContain("Completion attachment");
    expect(card).toContain("Copy school link");
    expect(card).toContain("Revoke and create a new link");
  });
});
