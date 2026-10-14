import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { nextOrderIndex, moveSubtopic, activeAfterDelete, docHasContent, EMPTY_DOC } from "../subtopics";

describe("notebook subtopics", () => {
  it("adds new subtopics at the end", () => {
    expect(nextOrderIndex([])).toBe(0);
    expect(nextOrderIndex([{ order_index: 0 }, { order_index: 3 }])).toBe(4);
  });
  it("moves a subtopic up", () => {
    const r = moveSubtopic([{ id: "a", order_index: 0 }, { id: "b", order_index: 1 }], "b", -1);
    expect(r.map((s) => s.id)).toEqual(["b", "a"]);
  });
  it("picks the first remaining subtopic after deleting the active one", () => {
    const list = [{ id: "a", order_index: 0 }, { id: "b", order_index: 1 }];
    expect(activeAfterDelete(list, "a", "a")).toBe("b");
    expect(activeAfterDelete(list, "b", "a")).toBe("a");
    expect(activeAfterDelete([{ id: "a", order_index: 0 }], "a", "a")).toBeNull();
  });
  it("treats a blank page as empty", () => {
    expect(docHasContent(EMPTY_DOC)).toBe(false);
    expect(docHasContent({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] })).toBe(true);
  });
});
