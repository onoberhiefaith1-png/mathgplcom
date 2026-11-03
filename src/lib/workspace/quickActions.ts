// The six places a teacher moves between all day.
//
// One list, two faces: the full Quick Action section on the Teaching Hub, and
// the small lightning strip that follows the teacher on every other page.

import { BookOpen, Compass, Gamepad2, Library, Sparkles, Users } from "lucide-react";
import type { FeatureKey } from "@/lib/entitlements/features";
import type { TranslationKey } from "@/lib/i18n/catalogues";
import type { FeatureCard } from "@/lib/theme/featureCards";

export interface QuickAction {
  to: string;
  labelKey: TranslationKey;
  icon: typeof BookOpen;
  feature?: FeatureKey;
  /** Subject-card color. See featureCards.ts for the product mapping. */
  card: FeatureCard;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { to: "/lesson-notes", labelKey: "nav_lesson_notes", icon: BookOpen, feature: "create_lesson_notes", card: "notes" },
  { to: "/smartboard", labelKey: "nav_smartboard", icon: Sparkles, feature: "smartboard", card: "board" },
  { to: "/teaching-hub/classes", labelKey: "nav_classes", icon: Users, feature: "classes", card: "class" },
  { to: "/game", labelKey: "nav_game", icon: Gamepad2, card: "game" },
  { to: "/adventure", labelKey: "nav_adventure", icon: Compass, feature: "adventure", card: "adventure" },
  // Academia is the closest hub tile to Connect to School.
  { to: "/academia", labelKey: "nav_academia", icon: Library, card: "school" },
];

/** The one page that already shows the full Quick Action section. */
export const QUICK_ACTION_HOME = "/teaching-hub";
