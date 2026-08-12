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
const ACCOUNT: WorkspaceNavGroup = {
  title: "Account",
  items: [
    { to: "/account", label: "Account & Go Live", icon: UserCircle },
    { to: "/teaching-hub/settings", label: "Settings", icon: Settings },
  ],
};

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

const PARENT: WorkspaceNavGroup[] = [
  {
    title: "Family",
    items: [
      HOME,
      { to: "/family", label: "My Children", icon: Users },
      { to: "/family/teachers", label: "My Teachers", icon: GraduationCap },
      { to: "/family?tab=progress", label: "Progress", icon: BarChart3 },
    ],
  },
  COMMUNITY,
  ACCOUNT,
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
