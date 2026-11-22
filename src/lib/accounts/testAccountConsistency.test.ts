import { describe, expect, it } from "vitest";
import { checkTestAccountConsistency, TEST_ACCOUNT_ROLES } from "./testAccountConsistency";

describe("test account consistency", () => {
  it("verifies four separate sign-ins with their actual matching roles", () => {
    const links = TEST_ACCOUNT_ROLES.map((role) => ({ role, target_user_id: role + "-user" }));
    const roles = links.map(({ target_user_id, role }) => ({ user_id: target_user_id, role }));
    expect(checkTestAccountConsistency("owner", links, roles).map((row) => row.status)).toEqual(
      ["linked", "linked", "linked", "linked"],
    );
  });

  it("flags duplicate links, missing accounts and unexpected elevated or wrong roles", () => {
    const rows = checkTestAccountConsistency("owner", [
      { role: "teacher", target_user_id: "first" },
      { role: "teacher", target_user_id: "second" },
      { role: "parent", target_user_id: "family" },
      { role: "student", target_user_id: "owner" },
    ], [
      { user_id: "family", role: "parent" },
      { user_id: "family", role: "co_admin" },
      { user_id: "owner", role: "student" },
    ]);
    expect(rows.map((row) => row.status)).toEqual(["missing", "duplicate", "role-mismatch", "role-mismatch"]);
  });
});
