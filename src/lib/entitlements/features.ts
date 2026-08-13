/**
 * The entitlement vocabulary shared by the administrator plan builder, the
 * client gates and the server checks.
 *
 * The keys mirror `public.feature_entitlements.key`. The catalogue itself lives
 * in the database — this file only names the keys so TypeScript can check a
 * gate against a real feature, and holds the customer-facing upgrade copy.
 */

export type FeatureKey =
  | "personal_workspace"
  | "community"
  | "community_lesson_notes"
  | "create_lesson_notes"
  | "smartboard"
  | "classes"
  | "students"
  | "teacher_payments"
  | "assignments"
  | "adventure"
  | "skill_builder"
  | "assessment"
  | "advanced_assessment"
  | "progress_tracking"
  | "reports"
  | "realtime_sessions"
  | "mathgpl_live"
  | "ai_generation"
  | "credits"
  | "add_credits"
  | "credit_activity"
  | "cloud_storage"
  | "export"
  | "connect_schools"
  | "connect_teachers"
  | "connect_parents"
  | "school_workspace"
  | "multiple_teachers"
  | "school_student_management"
  | "school_administration"
  | "school_progress_dashboard"
  | "school_assessment_dashboard"
  | "centralised_credits";

export type EntitlementCategory =
  | "teaching"
  | "assessment"
  | "ai_usage"
  | "connections"
  | "school_admin";

export const CATEGORY_LABEL: Record<EntitlementCategory, string> = {
  teaching: "Teaching",
  assessment: "Assessment & Progress",
  ai_usage: "AI & Usage",
  connections: "Connections",
  school_admin: "School Administration",
};

export const CATEGORY_ORDER: EntitlementCategory[] = [
  "teaching",
  "assessment",
  "ai_usage",
  "connections",
  "school_admin",
];

export type LimitKey = "max_classes" | "max_students";

export const LIMIT_LABEL: Record<LimitKey, string> = {
  max_classes: "Max classes",
  max_students: "Max students per class",
};

/** Where an entitlement came from: the account's own plan, or a connection. */
export type EntitlementSource = "own_plan" | "via_school" | "via_teacher" | "unconfigured";

/** What a customer reads when a feature is not part of their plan. */
export const UPGRADE_COPY: Partial<Record<FeatureKey, string>> = {
  create_lesson_notes:
    "Lesson Note generation is available on Teacher Pro. Upgrade to Pro to create and generate your own lesson notes.",
  ai_generation:
    "AI generation is available on a paid plan. Upgrade to generate solutions, lesson notes and covers.",
  assignments: "Assignments are available on a paid plan. Upgrade to set and mark work for your classes.",
  adventure: "Adventure is available on a paid plan. Upgrade to run adventures with your students.",
  skill_builder: "Skill Builder is available on a paid plan. Upgrade to build and publish skill courses.",
  reports: "Reports are available on a paid plan. Upgrade to see class and student reporting.",
  progress_tracking: "Progress tracking is available on a paid plan. Upgrade to follow student progress over time.",
  advanced_assessment: "Advanced assessment is available on a paid plan. Upgrade to use the full assessment engine.",
  realtime_sessions: "Real-time sessions are available on a paid plan. Upgrade to teach live.",
  mathgpl_live: "MathGPL Live is available on a paid plan. Upgrade to run live online sessions.",
  credits: "Credits are available on a paid plan. Upgrade to use credit-based features.",
  add_credits: "Buying credits is available on a paid plan. Upgrade to top up your balance.",
  credit_activity: "Credit activity is available on a paid plan.",
  cloud_storage: "Cloud storage is available on a paid plan. Upgrade to keep your material in the cloud.",
  export: "Export is available on a paid plan. Upgrade to download your material.",
  connect_teachers:
    "Connecting directly to a teacher is available on Parent Pro. Upgrade to pay for your child's teacher-led learning.",
  teacher_payments:
    "Receiving payments from your students is available on Teacher Pro. Upgrade to charge for access to your classes and be paid directly.",
};

export const upgradeMessage = (feature: FeatureKey, fallbackLabel?: string) =>
  UPGRADE_COPY[feature] ??
  `${fallbackLabel ?? "This feature"} is not part of your current plan. Upgrade to unlock it.`;

/** Message shown when a plan limit is reached. */
export const limitMessage = (limit: LimitKey, value: number) =>
  limit === "max_classes"
    ? `You have reached the Free Teacher limit of ${value} class. Upgrade to Teacher Pro for unlimited classes.`
    : `You have reached the Free Teacher limit of ${value} students. Upgrade to Teacher Pro for unlimited students.`;
