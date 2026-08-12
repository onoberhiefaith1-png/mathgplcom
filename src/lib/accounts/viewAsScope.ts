/**
 * "View as" scope — one person's workspace shown inside someone else's shell.
 *
 * A school administrator opening a connected teacher's Shared Workspace must
 * see *the teacher's own pages*: same layout, same text, same editor. Nothing
 * is rebuilt for the school — the real pages render, and every write is
 * refused with one sentence.
 *
 * The scope is module state (not just React context) because data helpers such
 * as `activeSchoolOrgId()` are called outside the component tree.
 */

export type ViewAsScope = {
  /** The person whose material is being viewed. */
  ownerId: string;
  /** The school workspace the material belongs to. */
  orgId: string;
  /** Display name, used in the lock message. */
  personName: string | null;
  /** Route prefix every in-app navigation is folded back into. */
  basePath: string;
};

let current: ViewAsScope | null = null;
const listeners = new Set<() => void>();

export function setViewAsScope(next: ViewAsScope | null): void {
  current = next;
  listeners.forEach((fn) => fn());
}

export function currentViewAs(): ViewAsScope | null {
  return current;
}

export function subscribeViewAs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The single message shown whenever a viewer tries to change something. */
export function lockMessage(personName?: string | null): string {
  const who = personName ? `${personName}` : "the teacher";
  return `You cannot make changes here. Only ${who} can edit this workspace.`;
}

/**
 * Folds a teacher-side path back into the school's read-only mirror so the
 * viewer never escapes into their own workspace.
 */
export function mapViewAsPath(pathname: string, base: string): string {
  if (!pathname.startsWith("/")) return pathname;
  if (pathname === base || pathname.startsWith(`${base}/`)) return pathname;
  // Leaving the mirror on purpose stays allowed.
  if (pathname.startsWith("/school") || pathname.startsWith("/auth") || pathname.startsWith("/login")) {
    return pathname;
  }

  const seg = pathname.split("/").filter(Boolean);
  const [first, second] = seg;

  if (first === "lesson-notes") return second ? `${base}/lesson-notes/${second}` : `${base}/lesson-notes`;
  if (first === "smartboard") return second ? `${base}/smartboard/${second}` : `${base}/smartboard`;
  if (first === "class") return second ? `${base}/classes/${second}` : `${base}/classes`;
  if (first === "teaching-hub") {
    if (second === "classes") return seg[2] ? `${base}/classes/${seg[2]}` : `${base}/classes`;
    return base;
  }
  if (first === "adventure") return `${base}/adventure`;
  // A student's own pages: /student/classes and /student/class/:id.
  if (first === "student") {
    if (second === "class" && seg[2]) return `${base}/classes/${seg[2]}`;
    return base;
  }
  if (first === "course-builder") return `${base}/skill-builder`;

  // Anything else has no read-only mirror — stay on the hub.
  return base;
}
