import {
  BarChart3,
  ClipboardList,
  BookOpen,
  Building2,
  Compass,
  CreditCard,
  GraduationCap,
  Gift,
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
import type { TranslationKey } from "@/lib/i18n/catalogues";

/**
 * `label` stays as the English master text; `labelKey` is the translation key
 * the shell resolves, so navigation follows the user's chosen language.
 */
export type WorkspaceNavItem = { to: string; label: string; labelKey: TranslationKey; icon: LucideIcon };
export type WorkspaceNavGroup = { title: string; titleKey: TranslationKey; items: WorkspaceNavItem[] };

const HOME: WorkspaceNavItem = { to: "/", label: "Building", labelKey: "nav_building", icon: Home };
const COMMUNITY: WorkspaceNavGroup = {
  title: "Community",
  titleKey: "group_community",
  items: [
    { to: "/community", label: "MathGPL Community", labelKey: "nav_community", icon: Globe2 },
    { to: "/requests", label: "Requests", labelKey: "nav_requests", icon: Inbox },
  ],
};
/** Teaching Hub settings belong to a teacher account, never to another role. */
const ACCOUNT: WorkspaceNavGroup = {
  title: "Account",
  titleKey: "group_account",
  items: [
    { to: "/account", label: "Account & Go Live", labelKey: "nav_account_go_live", icon: UserCircle },
    { to: "/teaching-hub/settings", label: "Settings", labelKey: "nav_settings", icon: Settings },
  ],
};

const ACCOUNT_ONLY: WorkspaceNavGroup = {
  title: "Account",
  titleKey: "group_account",
  items: [{ to: "/account", label: "Account & Go Live", labelKey: "nav_account_go_live", icon: UserCircle }],
};

/** Platform administration never shows authoring tools. */
const ADMIN: WorkspaceNavGroup[] = [
  {
    title: "Platform Console",
    titleKey: "group_platform_console",
    items: [
      HOME,
      { to: "/admin", label: "Overview", labelKey: "nav_overview", icon: LayoutDashboard },
      { to: "/admin/plans", label: "Plans", labelKey: "nav_plans", icon: Tag },
      { to: "/admin/credits", label: "Credits & Economics", labelKey: "nav_credits", icon: BarChart3 },
      { to: "/admin/usage-revenue", label: "Usage & Revenue", labelKey: "nav_usage_revenue", icon: BarChart3 },
      { to: "/referral", label: "Refer & Earn", labelKey: "nav_referral", icon: Gift },
    ],
  },
  COMMUNITY,
  ACCOUNT_ONLY,
];

const TEACHER: WorkspaceNavGroup[] = [
  {
    title: "Workspace",
    titleKey: "group_workspace",
    items: [
      HOME,
      { to: "/teaching-hub", label: "Teaching Hub", labelKey: "nav_teaching_hub", icon: LayoutDashboard },
      { to: "/lesson-notes", label: "Lesson Notes", labelKey: "nav_lesson_notes", icon: BookOpen },
      { to: "/smartboard", label: "SmartBoard", labelKey: "nav_smartboard", icon: Sparkles },
      { to: "/teaching-hub/classes", label: "Classes", labelKey: "nav_classes", icon: Users },
      { to: "/adventure", label: "Adventure", labelKey: "nav_adventure", icon: Compass },
      { to: "/course-builder", label: "Courses", labelKey: "nav_skill_builder", icon: GraduationCap },
      { to: "/live", label: "MathGPL Live", labelKey: "nav_live", icon: Radio },
      { to: "/plans", label: "Plan", labelKey: "nav_plan", icon: CreditCard },
      { to: "/teaching-hub/pricing", label: "Pricing", labelKey: "nav_pricing", icon: Tag },
      { to: "/referral", label: "Refer & Earn", labelKey: "nav_referral", icon: Gift },
    ],
  },
  {
    title: "My Connections",
    titleKey: "group_my_connections",
    items: [
      { to: "/requests?view=schools", label: "My Schools", labelKey: "nav_my_schools", icon: Building2 },
      { to: "/teaching-hub/students", label: "My Students", labelKey: "nav_my_students", icon: Users },
      { to: "/requests?view=parents", label: "Parents", labelKey: "nav_parents", icon: Users },
    ],
  },
  COMMUNITY,
  ACCOUNT,
];

const SCHOOL: WorkspaceNavGroup[] = [
  {
    title: "School Console",
    titleKey: "group_school_console",
    items: [
      HOME,
      { to: "/school", label: "Dashboard", labelKey: "nav_dashboard", icon: LayoutDashboard },
      { to: "/homepage/building", label: "Building", labelKey: "nav_building", icon: Building2 },
      { to: "/school/teachers", label: "Teachers", labelKey: "nav_teachers", icon: GraduationCap },
      { to: "/school/students", label: "Students", labelKey: "nav_students", icon: Users },
      { to: "/school?tab=reports", label: "Reports", labelKey: "nav_reports", icon: BarChart3 },
      { to: "/plans", label: "Plan", labelKey: "nav_plan", icon: CreditCard },
      { to: "/school/pricing", label: "Pricing", labelKey: "nav_pricing", icon: Tag },
      { to: "/account", label: "Account", labelKey: "nav_account", icon: UserCircle },
      { to: "/referral", label: "Refer & Earn", labelKey: "nav_referral", icon: Gift },
    ],
  },
  COMMUNITY,
  ACCOUNT_ONLY,
];


/**
 * The student never leaves their workspace: every entry except the Building and
 * the Community opens inside the workspace itself as a panel.
 */
const STUDENT: WorkspaceNavGroup[] = [
  {
    title: "Student Workspace",
    titleKey: "group_student_workspace",
    items: [
      HOME,
      { to: "/student?panel=classes", label: "My Classes", labelKey: "nav_my_classes", icon: Users },
      { to: "/student?panel=assignments", label: "Assignments", labelKey: "nav_assignments", icon: ClipboardList },
      { to: "/student?panel=adventure", label: "Adventure", labelKey: "nav_adventure", icon: Compass },
      { to: "/student?panel=courses", label: "Courses", labelKey: "nav_courses", icon: GraduationCap },
    ],
  },
  {
    title: "Connections",
    titleKey: "group_connections",
    items: [
      { to: "/student?panel=schools", label: "My Schools", labelKey: "nav_my_schools", icon: Building2 },
      { to: "/student?panel=teachers", label: "My Teachers", labelKey: "nav_my_teachers", icon: GraduationCap },
    ],
  },
  {
    title: "Community",
    titleKey: "group_community",
    items: [
      { to: "/community", label: "MathGPL Community", labelKey: "nav_community", icon: Globe2 },
      { to: "/student?panel=requests", label: "Requests", labelKey: "nav_requests", icon: Inbox },
    ],
  },
  {
    title: "Account",
    titleKey: "group_account",
    items: [
      { to: "/student?panel=account", label: "Account", labelKey: "nav_account", icon: UserCircle },
      { to: "/student?panel=golive", label: "Go Live", labelKey: "nav_go_live", icon: Radio },
    ],
  },
];

/**
 * A parent is a guardian and an observer. The Parent Console never borrows the
 * teacher's tools: no lesson notes, no SmartBoard, no classes, no adventures.
 */
const PARENT: WorkspaceNavGroup[] = [
  {
    title: "Parent Console",
    titleKey: "group_parent_console",
    items: [
      HOME,
      { to: "/family", label: "Dashboard", labelKey: "nav_dashboard", icon: LayoutDashboard },
      { to: "/family", label: "My Children", labelKey: "nav_my_children", icon: Users },
      { to: "/requests?view=schools", label: "School Connections", labelKey: "nav_school_connections", icon: Building2 },
      { to: "/family/teachers", label: "Teacher Connections", labelKey: "nav_teacher_connections", icon: GraduationCap },
      { to: "/plans", label: "Plan", labelKey: "nav_plan", icon: CreditCard },
    ],
  },
  COMMUNITY,
  {
    title: "Account",
    titleKey: "group_account",
    items: [{ to: "/account", label: "Account & Go Live", labelKey: "nav_account_go_live", icon: UserCircle }],
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
    titleKey: "group_shared_workspace",
    items: [
      HOME,
      { to: "/teaching-hub", label: "Teaching Hub", labelKey: "nav_teaching_hub", icon: LayoutDashboard },
      { to: "/lesson-notes", label: "Lesson Notes", labelKey: "nav_lesson_notes", icon: BookOpen },
      { to: "/smartboard", label: "SmartBoard", labelKey: "nav_smartboard", icon: Sparkles },
      { to: "/teaching-hub/classes", label: "Classes", labelKey: "nav_classes", icon: Users },
      { to: "/adventure", label: "Adventure", labelKey: "nav_adventure", icon: Compass },
      { to: "/course-builder", label: "Courses", labelKey: "nav_skill_builder", icon: GraduationCap },
      { to: "/live", label: "MathGPL Live", labelKey: "nav_live", icon: Radio },
    ],
  },
  COMMUNITY,
  {
    title: "Account",
    titleKey: "group_account",
    items: [{ to: "/account", label: "Account & Go Live", labelKey: "nav_account_go_live", icon: UserCircle }],
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
  if (role === "platform_owner" || role === "co_admin") return ADMIN;
  if (role === "student") return STUDENT;
  if (role === "parent") return PARENT;
  if (role === "school" && workspaceKind === "school") return SCHOOL;
  if (role === "school")
    return [
      { title: "School Console", titleKey: "group_school_console", items: [HOME] },
      COMMUNITY,
      ACCOUNT_ONLY,
    ];
  if (options?.shared) return SHARED_TEACHER;
  if (role === "teacher") return TEACHER;
  // No role: the Building only, never another account type's menu.
  return [{ title: "Workspace", titleKey: "group_workspace", items: [HOME] }, ACCOUNT_ONLY];
};
