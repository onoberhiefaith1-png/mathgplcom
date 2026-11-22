export const TEST_ACCOUNT_ROLES = ["school", "teacher", "parent", "student"] as const;
export type TestAccountRole = typeof TEST_ACCOUNT_ROLES[number];

type Consistency = "missing" | "duplicate" | "role-mismatch" | "linked";
type Link = { role: string; target_user_id: string };
type UserRole = { user_id: string; role: string };

/** Check the owner's links against the roles actually stored for their sign-ins. */
export function checkTestAccountConsistency(ownerId: string, links: readonly Link[], roles: readonly UserRole[]) {
  return TEST_ACCOUNT_ROLES.map((role): { role: TestAccountRole; status: Consistency; userId: string | null } => {
    const matches = links.filter((link) => link.role === role);
    if (!matches.length) return { role, status: "missing", userId: null };
    const userId = matches[0].target_user_id;
    if (matches.length > 1 || links.filter((link) => link.target_user_id === userId).length > 1) {
      return { role, status: "duplicate", userId: null };
    }
    const assigned = new Set(roles.filter((row) => row.user_id === userId).map((row) => row.role));
    const matchesRole = userId !== ownerId && assigned.size === 1 && assigned.has(role);
    return { role, status: matchesRole ? "linked" : "role-mismatch", userId };
  });
}
