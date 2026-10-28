// @vitest-environment jsdom
// Phase 6 — the guardrails: nothing destructive without a yes, and a daily ceiling.

import { beforeEach, describe, expect, it } from "vitest";

import { AGENT_TOOL_MANIFEST, findAgentTool } from "../toolTypes";
import {
  ceilingReached,
  countRequest,
  DAILY_REQUEST_CEILING,
  describeUsage,
  readUsage,
  remainingRequests,
} from "../usageLimits";

describe("destructive tools", () => {
  it("marks every removing action as needing confirmation", () => {
    for (const id of ["archive_lesson_note", "remove_student_from_class"]) {
      expect(findAgentTool(id)?.needsConfirmation).toBe(true);
    }
  });

  it("keeps read-only tools out of the confirmation gate", () => {
    for (const tool of AGENT_TOOL_MANIFEST) {
      if (tool.readOnly) expect(tool.needsConfirmation).toBe(false);
    }
  });
});

describe("daily ceiling", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("counts requests for the day and reports what is left", () => {
    countRequest();
    const usage = countRequest();
    expect(usage.used).toBe(2);
    expect(readUsage().used).toBe(2);
    expect(remainingRequests(usage)).toBe(DAILY_REQUEST_CEILING - 2);
    expect(ceilingReached(usage)).toBe(false);
  });

  it("says nothing until the allowance runs low, then speaks plainly", () => {
    expect(describeUsage({ day: "2026-01-01", used: 1 })).toBeNull();
    expect(describeUsage({ day: "2026-01-01", used: DAILY_REQUEST_CEILING - 5 })).toContain(
      "5 more requests",
    );
    expect(describeUsage({ day: "2026-01-01", used: DAILY_REQUEST_CEILING })).toContain(
      "today's limit",
    );
  });

  it("starts a fresh count on a new day", () => {
    window.localStorage.setItem(
      "mathgpl:aura:usage",
      JSON.stringify({ day: "2020-01-01", used: 900 }),
    );
    expect(readUsage().used).toBe(0);
  });
});
