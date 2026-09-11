/**
 * Account roles, capabilities and role-based navigation.
 *
 * Capabilities are data (public.role_capabilities) rather than hard-coded
 * `if (role === "teacher")` checks, so a future Tutor / Head of Department
 * role is a row insert, not a rewrite.
 */

export type AppRole =
  | "platform_owner"
  | "co_admin"
  | "school"
  | "teacher"
  | "parent"
  | "student";

/** Roles a visitor may pick when they register. */
export type SignupRole = "school" | "teacher" | "parent" | "student";

export const SIGNUP_ROLES: { value: SignupRole; label: string; blurb: string }[] = [
  { value: "school", label: "School", blurb: "Manage teachers, students and classes for an institution." },
  { value: "teacher", label: "Teacher", blurb: "Create lesson notes, classes, adventures and SmartBoards." },
  { value: "parent", label: "Parent", blurb: "Follow your children's learning at home." },
  { value: "student", label: "Student", blurb: "Join a class and learn." },
];

export type Capability =
  | "platform_admin"
  | "manage_accounts"
  | "manage_teachers"
  | "manage_students"
  | "create_class"
  | "join_class"
  | "create_lesson_notes"
  | "view_lesson_notes"
  | "ai_generation"
  | "billing"
  | "reports"
  | "analytics"
  | "smartboard";

/**
 * Where each role lands after signing in.
 *
 * Every account arrives on the Rotating Building homepage first; from there
 * they enter their own workspace. The dashboards below stay directly
 * reachable — only the automatic redirect target is the homepage.
 */
export const HOME_PATH: Record<AppRole, string> = {
  platform_owner: "/",
  co_admin: "/",
  school: "/",
  teacher: "/",
  parent: "/",
  student: "/",
};

/**
 * The dashboard each role opens from the homepage or the Account menu.
 *
 * This map is the ONLY place a role is turned into a destination. There is no
 * fallback: an account without a role goes nowhere rather than being treated
 * as a teacher.
 */
export const WORKSPACE_PATH: Record<AppRole, string> = {
  platform_owner: "/admin",
  co_admin: "/admin",
  school: "/school",
  teacher: "/teaching-hub",
  parent: "/family",
  student: "/student",
};

/** The name of each role's own workspace, used on entry buttons. */
export const WORKSPACE_LABEL: Record<AppRole, string> = {
  platform_owner: "Platform Console",
  co_admin: "Platform Console",
  school: "School Console",
  teacher: "Teaching Hub",
  parent: "Parent Console",
  student: "My Dashboard",
};

/** Which roles each workspace area belongs to. Used by the route guards. */
export const AREA_ROLES: Record<string, AppRole[]> = {
  "/admin": ["platform_owner", "co_admin"],
  "/school": ["school"],
  "/teaching-hub": ["teacher"],
  "/family": ["parent"],
  "/student": ["student"],
};


export type NavItem = { to: string; label: string };

/** Menus are per role — items a role cannot use are never rendered. */
export const ROLE_NAV: Record<AppRole, NavItem[]> = {
  platform_owner: [
    { to: "/admin", label: "Overview" },
    { to: "/admin?tab=schools", label: "Schools" },
    { to: "/admin?tab=teachers", label: "Teachers" },
    { to: "/admin?tab=parents", label: "Parents" },
    { to: "/admin?tab=students", label: "Students" },
    { to: "/admin?tab=admins", label: "Co-Administrators" },
    { to: "/community", label: "MathGPL Community" },
  ],
  co_admin: [
    { to: "/admin", label: "Overview" },
    { to: "/admin?tab=schools", label: "Schools" },
    { to: "/admin?tab=teachers", label: "Teachers" },
    { to: "/community", label: "MathGPL Community" },
  ],
  // School administration is administrative only — the Teaching Hub belongs
  // to a teacher account, never to a school's own navigation.
  school: [
    { to: "/school", label: "Dashboard" },
    { to: "/school/teachers", label: "Teachers" },
    { to: "/school/students", label: "Students" },
    { to: "/school?tab=reports", label: "Reports" },
    { to: "/school?tab=analytics", label: "Analytics" },
    { to: "/school?tab=accounts", label: "Accounts" },
    { to: "/school?tab=billing", label: "Billing" },
    { to: "/requests", label: "Requests" },
    { to: "/community/discover", label: "MathGPL Community" },
    { to: "/account", label: "Account & Go Live" },
    { to: "/teaching-hub/settings", label: "Settings" },
  ],
  teacher: [
    { to: "/teaching-hub", label: "Teaching Hub" },
    { to: "/lesson-notes", label: "Lesson Notes" },
    { to: "/smartboard", label: "SmartBoard" },
    { to: "/teaching-hub/classes", label: "Classes" },
    { to: "/live", label: "MathGPL Live" },
    { to: "/requests?view=schools", label: "My Schools" },
    { to: "/requests?view=students", label: "My Students" },
    { to: "/requests?view=parents", label: "Parents" },
    { to: "/requests?view=teachers", label: "Other Teachers" },
    { to: "/requests", label: "Requests" },
    { to: "/community/discover", label: "MathGPL Community" },
    { to: "/account", label: "Account & Go Live" },
    { to: "/teaching-hub/settings", label: "Settings" },
  ],
  parent: [
    { to: "/family", label: "My Children" },
    { to: "/family?tab=progress", label: "Progress" },
    { to: "/family?tab=reports", label: "Reports" },
    { to: "/requests?view=schools", label: "My Schools" },
    { to: "/family/teachers", label: "My Teachers" },
    { to: "/requests", label: "Requests" },
    { to: "/community/discover", label: "MathGPL Community" },
    { to: "/account", label: "Account & Go Live" },
    { to: "/family?tab=settings", label: "Settings" },
  ],
  student: [
    { to: "/student", label: "Dashboard" },
    { to: "/student/classes", label: "My Classes" },
    { to: "/student/assignments", label: "Assignments" },
    { to: "/student/adventures", label: "Adventure" },
    { to: "/student/skill-builder", label: "Courses" },
    
    { to: "/requests?view=schools", label: "My Schools" },
    { to: "/requests?view=teachers", label: "My Teachers" },
    { to: "/requests", label: "Requests" },
    { to: "/community/discover", label: "MathGPL Community" },
    { to: "/account", label: "Account & Go Live" },
  ],
};

export const ROLE_LABEL: Record<AppRole, string> = {
  platform_owner: "Platform Owner",
  co_admin: "Co-Administrator",
  school: "School",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

/**
 * Navigation is a function of role *and* the active workspace, not role alone.
 *
 * A teacher inside a school keeps Teaching Hub but gains no school
 * administration; a school workspace keeps administration, supervision and
 * reports; platform administration never shows teacher authoring tools.
 */
export const navFor = (role: AppRole | null, workspaceKind?: string): NavItem[] => {
  // No role, no menu — a roleless account is never shown a teacher's menu.
  if (!role) return [];
  const items = ROLE_NAV[role];
  if (!workspaceKind) return items;

  // Visiting a school workspace as a teacher: no school administration.
  if (role === "teacher" && workspaceKind === "school") {
    return items.filter((item) => !item.to.startsWith("/school"));
  }
  // Own personal workspace: nothing school-scoped applies.
  if (role === "school" && workspaceKind !== "school") {
    return items.filter((item) => !item.to.startsWith("/school"));
  }
  return items;
};

