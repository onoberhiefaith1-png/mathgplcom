// WS-003 — strict workspace isolation. Every "my content" query must be
// scoped, and a personal workspace must be expressed as org_id IS NULL rather
// than left unfiltered (an unfiltered query is how content leaked between
// workspaces).
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, rpc: async () => ({ data: [] }), from: () => ({}) },
}));

const viewAs: { value: { ownerId: string; orgId: string | null } | null } = { value: null };
vi.mock("@/lib/accounts/viewAsScope", () => ({ currentViewAs: () => viewAs.value }));

import { viewOwnerId, withOwnerView, withWorkspaceScope } from "@/lib/accounts/workspaceScope";

/** Minimal query recorder shaped like a Supabase filter builder. */
function fakeQuery() {
  const calls: string[] = [];
  const q: any = {
    calls,
    eq: (c: string, v: string) => { calls.push(`eq:${c}=${v}`); return q; },
    is: (c: string, v: null) => { calls.push(`is:${c}=null`); return q; },
  };
  return q;
}

describe("workspace isolation (WS-003)", () => {
  it("scopes a school workspace to its org_id", () => {
    const q = fakeQuery();
    withWorkspaceScope(q, "org-1");
    expect(q.calls).toEqual(["eq:org_id=org-1"]);
  });

  it("scopes the personal workspace to org_id IS NULL — never unfiltered", () => {
    const q = fakeQuery();
    withWorkspaceScope(q, null);
    expect(q.calls).toEqual(["is:org_id=null"]);
  });

  it("always applies exactly one workspace filter", () => {
    for (const org of ["org-2", null]) {
      const q = fakeQuery();
      withWorkspaceScope(q, org);
      expect(q.calls).toHaveLength(1);
    }
  });

  it("owner defaults to the signed-in user", () => {
    viewAs.value = null;
    expect(viewOwnerId("user-1")).toBe("user-1");
    const q = fakeQuery();
    withOwnerView(q);
    expect(q.calls).toEqual([]);
  });

  it("view-as pins both the owner and the owner filter to the viewed person", () => {
    viewAs.value = { ownerId: "user-2", orgId: "org-9" };
    expect(viewOwnerId("user-1")).toBe("user-2");
    const q = fakeQuery();
    withOwnerView(q);
    expect(q.calls).toEqual(["eq:owner_id=user-2"]);
    viewAs.value = null;
  });
});
