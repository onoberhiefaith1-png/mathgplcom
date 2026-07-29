/**
 * Per-role registration configuration.
 *
 * Every role shares one authentication engine (Supabase email/password plus
 * Google); only the extra registration fields, wording and destination change.
 */
import type { AppRole, SignupRole } from "@/lib/accounts/roles";

export type AuthRoleKey = "admin" | "school" | "teacher" | "parent" | "student";

export type ExtraField = {
  name:
    | "school_name"
    | "school_type"
    | "website"
    | "display_name"
    | "subjects_taught"
    | "children_count"
    | "date_of_birth";
  label: string;
  type: "text" | "date" | "number" | "url" | "select";
  required?: boolean;
  options?: string[];
  hint?: string;
};

export type AuthRoleConfig = {
  key: AuthRoleKey;
  role: AppRole;
  signupRole: SignupRole | null;
  title: string;
  blurb: string;
  /** Platform administrators are invited, never self-registered. */
  allowSignup: boolean;
  extraFields: ExtraField[];
};

export const AUTH_ROLES: Record<AuthRoleKey, AuthRoleConfig> = {
  admin: {
    key: "admin",
    role: "platform_owner",
    signupRole: null,
    title: "Platform Administrator",
    blurb: "Owner and authorised co-administrators only.",
    allowSignup: false,
    extraFields: [],
  },
  school: {
    key: "school",
    role: "school",
    signupRole: "school",
    title: "School Account",
    blurb: "Manage teachers, students, classes and billing for your institution.",
    allowSignup: true,
    extraFields: [
      { name: "school_name", label: "School name", type: "text", required: true },
      {
        name: "school_type",
        label: "School type",
        type: "select",
        required: true,
        options: ["Primary", "Secondary", "Combined", "College", "Tutoring centre", "Other"],
      },
      { name: "website", label: "Website (optional)", type: "url" },
    ],
  },
  teacher: {
    key: "teacher",
    role: "teacher",
    signupRole: "teacher",
    title: "Teacher Account",
    blurb: "Create lesson notes, classes, adventures and SmartBoards.",
    allowSignup: true,
    extraFields: [
      { name: "display_name", label: "Display name", type: "text", required: true },
      { name: "subjects_taught", label: "Subjects taught (optional)", type: "text" },
      { name: "school_name", label: "School (optional if independent)", type: "text" },
    ],
  },
  parent: {
    key: "parent",
    role: "parent",
    signupRole: "parent",
    title: "Parent Account",
    blurb: "Follow your children's learning and manage their tutoring.",
    allowSignup: true,
    extraFields: [
      { name: "display_name", label: "Display name", type: "text", required: true },
      { name: "children_count", label: "Number of children (optional)", type: "number" },
    ],
  },
  student: {
    key: "student",
    role: "student",
    signupRole: "student",
    title: "Student Account",
    blurb: "Join your class and start learning.",
    allowSignup: true,
    extraFields: [
      {
        name: "date_of_birth",
        label: "Date of birth",
        type: "date",
        required: true,
        hint: "Used privately to recommend age-appropriate content. Never shown publicly.",
      },
    ],
  },
};

export const ACCOUNT_MENU: { key: AuthRoleKey; label: string }[] = [
  { key: "admin", label: "Platform Administrator" },
  { key: "school", label: "School Account" },
  { key: "teacher", label: "Teacher Account" },
  { key: "parent", label: "Parent Account" },
  { key: "student", label: "Student Account" },
];

export const COUNTRIES = [
  "Nigeria", "Ghana", "Kenya", "South Africa", "United Kingdom", "Ireland",
  "United States", "Canada", "Australia", "New Zealand", "India", "Pakistan",
  "United Arab Emirates", "Saudi Arabia", "Egypt", "Germany", "France",
  "Netherlands", "Spain", "Italy", "Portugal", "Brazil", "Mexico",
  "Singapore", "Malaysia", "Philippines", "Indonesia", "Japan", "China", "Other",
];

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}
