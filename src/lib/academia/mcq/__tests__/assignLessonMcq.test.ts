import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  from: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), copy: vi.fn(), deleted: vi.fn(), inserted: vi.fn(), ordered: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: database.from, rpc: database.rpc, auth: { getUser: database.getUser } },
}));
vi.mock("../api", () => ({ assignPaperToSession: database.copy }));

import { assignLessonMcq } from "../assignLessonMcq";

const input = { sessionId: "session", notebookId: "note", subsectionId: "question-1", title: "Practice", tier: "expert" as const };
const problem = "Simplify 3x + 5x.\nA. 15x\nB. 2x\nC. 8x\nCorrect Option: C";

beforeEach(() => {
  vi.resetAllMocks();
  database.getUser.mockResolvedValue({ data: { user: { id: "teacher" } } });
  database.rpc.mockResolvedValue({ data: "subject" });
  database.inserted.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "paper" } }) }) });
  database.deleted.mockResolvedValue({});
  database.copy.mockResolvedValue("activity");
  database.ordered.mockResolvedValue({ data: [{ content_ascii: problem }] });
  const problemRead = { eq: () => problemRead, order: database.ordered };
  database.from.mockImplementation((table) => table === "notebook_blocks"
    ? { select: () => problemRead }
    : { insert: database.inserted, delete: () => ({ eq: database.deleted }) });
});

describe("assigning a lesson MCQ to an Academia Session", () => {
  it("copies each selected question, its original options and answer into the chosen Session and tier", async () => {
    await expect(assignLessonMcq(input)).resolves.toBe(true);
    await expect(assignLessonMcq({ ...input, subsectionId: "question-2" })).resolves.toBe(true);
    expect(database.rpc).toHaveBeenCalledWith("academia_subject_of_session", { _session: "session" });
    expect(database.ordered).toHaveBeenCalledWith("order_index");
    expect(database.copy).toHaveBeenNthCalledWith(1, "session", expect.objectContaining({
      questions: [{ n: 1, text: "Simplify 3x + 5x.", options: [
        { label: "A", text: "15x" }, { label: "B", text: "2x" }, { label: "C", text: "8x" },
      ], answer: "C", source: { notebookId: "note", subsectionId: "question-1" } }],
    }), [1], "expert", "question-1");
    expect(database.copy).toHaveBeenNthCalledWith(2, "session", expect.anything(), [1], "expert", "question-2");
  });

  it("recognises an older question saved with literal newline escapes", async () => {
    database.ordered.mockResolvedValue({ data: [{ content_ascii: problem.replace(/\n/g, "\\n") }] });
    await expect(assignLessonMcq(input)).resolves.toBe(true);
    expect(database.copy).toHaveBeenCalledOnce();
  });

  it("reports the Session copy failure and removes the unused paper", async () => {
    database.copy.mockRejectedValue(new Error("Session permission denied"));
    await expect(assignLessonMcq(input)).rejects.toThrow("Session permission denied");
    expect(database.deleted).toHaveBeenCalledWith("id", "paper");
  });

  it("routes worked questions separately and does not write after a failed question lookup", async () => {
    database.ordered.mockResolvedValueOnce({ data: [{ content_ascii: "Solve x + 1 = 5" }] });
    await expect(assignLessonMcq(input)).resolves.toBe(false);
    const error = new Error("Question lookup failed");
    database.ordered.mockResolvedValueOnce({ error });
    await expect(assignLessonMcq(input)).rejects.toBe(error);
    expect(database.inserted).not.toHaveBeenCalled();
  });
});
