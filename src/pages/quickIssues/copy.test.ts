import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  "src/pages/quickIssues/QuickIssueTrackerPage.tsx",
  "utf8",
);
const list = readFileSync("src/pages/quickIssues/IssueList.tsx", "utf8");
const card = readFileSync("src/pages/staffHub/QuickIssueCard.tsx", "utf8");
const surface = readFileSync("src/pages/quickIssues/surface.ts", "utf8");

describe("tracker wording", () => {
  it("does not call the completion attachment proof", () => {
    const text = `${page}\n${list}\n${card}\n${surface}`.toLowerCase();
    expect(text).not.toContain("proof");
    expect(list).toContain("Completion attachment");
    expect(card).toContain("Copy school link");
    expect(card).toContain("Revoke and create a new link");
  });

  it("paints the tracker with the light paper tokens", () => {
    expect(surface).toContain("214 80% 97%");
    expect(surface).toContain("bg-dash-surface");
    expect(surface).toContain("bg-dash-navy");
    expect(surface).toContain("bg-dash-gold");
    expect(page).toContain("desk");
    expect(list).toContain("dash-surface");
    expect(card).toContain("dash-surface");
    expect(page).not.toContain("bg-background");
    expect(card).not.toContain("bg-background");
  });
});
