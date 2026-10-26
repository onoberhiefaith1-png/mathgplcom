import { afterEach, expect, it, vi } from "vitest";
import { boardKey, buildBoardScope, clearBoardScope } from "../boardScope";
afterEach(() => vi.unstubAllGlobals());
it("Reset clears every table reservoir for this board and preserves other boards and saved designs", () => {
  const scope = buildBoardScope({ studentId: "student", classId: "SS1", workspace: "game", gameId: "game", assessmentId: "paper", questionId: "q1" });
  const other = scope + "-other";
  const values = new Map<string, string>([
    [boardKey("freeLines", scope), "working"],
    [boardKey("tableActivity", scope) + ":0", "table answers"],
    [boardKey("tableActivity", scope) + ":3", "subcell working"],
    [boardKey("tableActivity", other) + ":0", "other question"],
    ["lesson:table-design", "saved design"],
  ]);
  vi.stubGlobal("window", { localStorage: { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null, removeItem: (key: string) => values.delete(key) } });
  clearBoardScope(scope);
  expect([...values.keys()]).toEqual([boardKey("tableActivity", other) + ":0", "lesson:table-design"]);
});
