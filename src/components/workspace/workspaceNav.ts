import {
  BarChart3,
  ClipboardList,
  BookOpen,
  Building2,
  Compass,
  GraduationCap,
  Globe2,
  Home,
  Inbox,
  LayoutDashboard,
  Radio,
  Settings,
  Sparkles,
  Tag,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/lib/accounts/roles";

export type WorkspaceNavItem = { to: string; label: string; icon: LucideIcon };
export type WorkspaceNavGroup = { title: string; items: WorkspaceNavItem[] };

const HOME: WorkspaceNavItem = { to: "/", label: "Building", icon: Home };
const COMMUNITY: WorkspaceNavGroup = {
  title: "Community",
  items: [
    { to: "/community", label: "MathGPL Community", icon: Globe2 },
    { to: "/requests", label: "Requests", icon: Inbox },
  ],
};
/** Teaching Hub settings belong to a teacher account, never to another role. */
const ACCOUNT: WorkspaceNavGroup = {
  title: "Account",
  items: [
    { to: "/account", label: "Account & Go Live", icon: UserCircle },
    { to: "/teaching-hub/settings", label: "Settings", icon: Settings },
  ],
};

const ACCOUNT_ONLY: WorkspaceNavGroup = {
  title: "Account",
  items: [{ to: "/account", label: "Account & Go Live", icon: UserCircle }],
};

/** Platform administration never shows authoring tools. */
const ADMIN: WorkspaceNavGroup[] = [
  {
    title: "Platform Console",
    items: [
      HOME,
      { to: "/admin", label: "Overview", icon: LayoutDashboard },
      { to: "/admin/plans", label: "Plans", icon: Tag },
      { to: "/admin/credits", label: "Credits & Economics", icon: BarChart3 },
      { to: "/admin/usage-revenue", label: "Usage & Revenue", icon: BarChart3 },
    ],
  },
  COMMUNITY,
  ACCOUNT_ONLY,
];

const TEACHER: WorkspaceNavGroup[] = [
  {
    title: "Workspace",
    items: [
      HOME,
      { to: "/teaching-hub", label: "Teaching Hub", icon: LayoutDashboard },
      { to: "/lesson-notes", label: "Lesson Notes", icon: BookOpen },
      { to: "/smartboard", label: "SmartBoard", icon: Sparkles },
      { to: "/teaching-hub/classes", label: "Classes", icon: Users },
      { to: "/adventure", label: "Adventure", icon: Compass },
      { to: "/course-builder", label: "Skill Builder", icon: GraduationCap },
      { to: "/live", label: "MathGPL Live", icon: Radio },
      { to: "/teaching-hub/pricing", label: "Pricing", icon: Tag },
    ],
  },
  {
    title: "My Connections",
    items: [
      { to: "/requests?view=schools", label: "My Schools", icon: Building2 },
      { to: "/teaching-hub/students", label: "My Students", icon: Users },
      { to: "/requests?view=parents", label: "Parents", icon: Users },
    ],
  },
  COMMUNITY,
  ACCOUNT,
];

const SCHOOL: WorkspaceNavGroup[] = [
  {
    title: "School Console",
    items: [
      HOME,
      { to: "/school", label: "Dashboard", icon: LayoutDashboard },
      { to: "/homepage/building", label: "Building", icon: Building2 },
      { to: "/school/teachers", label: "Teachers", icon: GraduationCap },
      { to: "/school/students", label: "Students", icon: Users },
      { to: "/school?tab=reports", label: "Reports", icon: BarChart3 },
      { to: "/school/pricing", label: "Pricing", icon: Tag },
      { to: "/account", label: "Account", icon: UserCircle },
    ],
  },
  COMMUNITY,
  ACCOUNT,
];


const STUDENT: WorkspaceNavGroup[] = [
  {
    title: "Student Dashboard",
    items: [
      HOME,
      { to: "/student", label: "Dashboard", icon: LayoutDashboard },
      { to: "/student/classes", label: "My Classes", icon: Users },
      { to: "/student/assignments", label: "Assignments", icon: ClipboardList },
      { to: "/student/adventures", label: "Adventure", icon: Compass },
      { to: "/student/skill-builder", label: "Skill Builder", icon: GraduationCap },
      { to: "/student/join", label: "Join Class", icon: Inbox },
    ],
  },
  {
    title: "Connections",
    items: [
      { to: "/requests?view=schools", label: "My Schools", icon: Building2 },
      { to: "/requests?view=teachers", label: "My Teachers", icon: GraduationCap },
    ],
  },
  COMMUNITY,
  {
    title: "Account",
    items: [{ to: "/account", label: "Account & Go Live", icon: UserCircle }],
  },
];

/**
 * A parent is a guardian and an observer. The Parent Console never borrows the
 * teacher's tools: no lesson notes, no SmartBoard, no classes, no adventures.
 */
const PARENT: WorkspaceNavGroup[] = [
  {
    title: "Parent Console",
    items: [
      HOME,
      { to: "/family", label: "Dashboard", icon: LayoutDashboard },
      { to: "/family", label: "My Children", icon: Users },
      { to: "/requests?view=schools", label: "School Connections", icon: Building2 },
      { to: "/family/teachers", label: "Teacher Connections", icon: GraduationCap },
    ],
  },
  COMMUNITY,
  {
    title: "Account",
    items: [{ to: "/account", label: "Account & Go Live", icon: UserCircle }],
  },
];


/**
 * A connected teacher inside a school operates the Shared Workspace: they teach
 * there, but the Building belongs to the school, so no building editing and no
 * school administration appears for them.
 */
const SHARED_TEACHER: WorkspaceNavGroup[] = [
  {
    title: "Shared Workspace",
    items: [
      HOME,
      { to: "/teaching-hub", label: "Teaching Hub", icon: LayoutDashboard },
      { to: "/lesson-notes", label: "Lesson Notes", icon: BookOpen },
      { to: "/smartboard", label: "SmartBoard", icon: Sparkles },
      { to: "/teaching-hub/classes", label: "Classes", icon: Users },
      { to: "/adventure", label: "Adventure", icon: Compass },
      { to: "/course-builder", label: "Skill Builder", icon: GraduationCap },
      { to: "/live", label: "MathGPL Live", icon: Radio },
    ],
  },
  COMMUNITY,
  {
    title: "Account",
    items: [{ to: "/account", label: "Account & Go Live", icon: UserCircle }],
  },
];

/**
 * Navigation is grouped by what the person actually does, and it follows the
 * role *and* the workspace: a teacher inside a school never gains school
 * administration, and a school workspace never shows a Teaching Hub.
 */
export const navGroupsFor = (
  role: AppRole | null,
  workspaceKind?: string,
  options?: { shared?: boolean },
): WorkspaceNavGroup[] => {
  if (role === "student") return STUDENT;
  if (role === "parent") return PARENT;
  if (role === "school" && workspaceKind === "school") return SCHOOL;
  if (role === "school") return [{ title: "School Console", items: [HOME] }, COMMUNITY, ACCOUNT];
  if (options?.shared) return SHARED_TEACHER;
  return TEACHER;

};
