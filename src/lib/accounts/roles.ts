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

/** Where each role lands after signing in. */
export const HOME_PATH: Record<AppRole, string> = {
  platform_owner: "/admin",
  co_admin: "/admin",
  school: "/school",
  teacher: "/teaching-hub",
  parent: "/family",
  student: "/student/classes",
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
  ],
  co_admin: [
    { to: "/admin", label: "Overview" },
    { to: "/admin?tab=schools", label: "Schools" },
    { to: "/admin?tab=teachers", label: "Teachers" },
  ],
  school: [
    { to: "/teaching-hub", label: "Teaching Hub" },
    { to: "/school?tab=teachers", label: "Teachers" },
    { to: "/school?tab=students", label: "Students" },
    { to: "/teaching-hub/classes", label: "Classes" },
    { to: "/school?tab=reports", label: "Reports" },
    { to: "/school?tab=analytics", label: "Analytics" },
    { to: "/school?tab=accounts", label: "Accounts" },
    { to: "/school?tab=billing", label: "Billing" },
    { to: "/teaching-hub/settings", label: "Settings" },
  ],
  teacher: [
    { to: "/teaching-hub", label: "Teaching Hub" },
    { to: "/lesson-notes", label: "Lesson Notes" },
    { to: "/smartboard", label: "SmartBoard" },
    { to: "/teaching-hub/classes", label: "Classes" },
    { to: "/live", label: "MathGPL Live" },
    { to: "/teaching-hub/settings", label: "Settings" },
  ],
  parent: [
    { to: "/family", label: "Children" },
    { to: "/family?tab=progress", label: "Progress" },
    { to: "/family?tab=reports", label: "Reports" },
    { to: "/family?tab=teachers", label: "Teachers" },
    { to: "/family?tab=settings", label: "Settings" },
  ],
  student: [{ to: "/student/classes", label: "My Classes" }],
};

export const ROLE_LABEL: Record<AppRole, string> = {
  platform_owner: "Platform Owner",
  co_admin: "Co-Administrator",
  school: "School",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};
