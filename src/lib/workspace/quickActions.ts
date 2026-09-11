// The five places a teacher moves between all day.
//
// One list, two faces: the full Quick Action section on the Teaching Hub, and
// the small lightning strip that follows the teacher on every other page.

import { BookOpen, Compass, GraduationCap, Sparkles, Users } from "lucide-react";
import type { FeatureKey } from "@/lib/entitlements/features";
import type { TranslationKey } from "@/lib/i18n/catalogues";

export interface QuickAction {
  to: string;
  labelKey: TranslationKey;
  icon: typeof BookOpen;
  feature?: FeatureKey;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { to: "/lesson-notes", labelKey: "nav_lesson_notes", icon: BookOpen, feature: "create_lesson_notes" },
  { to: "/smartboard", labelKey: "nav_smartboard", icon: Sparkles, feature: "smartboard" },
  { to: "/teaching-hub/classes", labelKey: "nav_classes", icon: Users, feature: "classes" },
  { to: "/adventure", labelKey: "nav_adventure", icon: Compass, feature: "adventure" },
  { to: "/course-builder", labelKey: "nav_skill_builder", icon: GraduationCap, feature: "skill_builder" },
];

/** The one page that already shows the full Quick Action section. */
export const QUICK_ACTION_HOME = "/teaching-hub";
