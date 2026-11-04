import { beforeEach, describe, expect, it, vi } from "vitest";
const { getUser, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser }, rpc } }));
import { duplicateAcademiaBranch } from "../duplication";

describe("Academia duplication RPC", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "teacher" } } });
    rpc.mockReset();
  });
  it.each(["class", "subject", "topic", "subtopic", "session"] as const)("sends the selected %s and source identity", async kind => {
    rpc.mockResolvedValue({ data: { id: `new-${kind}`, kind, name: "Mathematics duplicate", counts: {} }, error: null });
    const result = await duplicateAcademiaBranch(kind, `source-${kind}`);
    expect(result.kind).toBe(kind);
    expect(rpc).toHaveBeenCalledWith("academia_duplicate_branch", {
      _kind: kind, _id: `source-${kind}`, _request: expect.any(String),
    });
  });
  it("rejects signed-out users without calling the database", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(duplicateAcademiaBranch("class", "signed-out")).rejects.toThrow("Sign in");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps the server request id when a response is uncertain", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(duplicateAcademiaBranch("session", "uncertain")).rejects.toThrow("not confirmed");
    const request = rpc.mock.calls[0][1]._request;
    rpc.mockResolvedValueOnce({ data: { id: "copy", kind: "session", name: "Session duplicate", counts: {} }, error: null });
    await duplicateAcademiaBranch("session", "uncertain");
    expect(rpc.mock.calls[1][1]._request).toBe(request);
  });
  it("does not accept a result for a different level", async () => {
    rpc.mockResolvedValue({ data: { id: "other", kind: "subject", name: "Wrong level" }, error: null });
    await expect(duplicateAcademiaBranch("topic", "wrong-level")).rejects.toThrow("not confirmed");
  });
  it("surfaces permission failures instead of claiming a shallow copy succeeded", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "A linked lesson note is private." } });
    await expect(duplicateAcademiaBranch("subject", "private-source")).rejects.toThrow("private");
  });
});
