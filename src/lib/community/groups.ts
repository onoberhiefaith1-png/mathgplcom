import type { CommunityKind } from "./types";

/**
 * A Community Dashboard reads as sections of published material, not one flat
 * list. The owner's dashboard and a visitor's public view use the same groups
 * so both tell the same story about what has been shared.
 */
export const SHARED_GROUPS: { label: string; kinds: CommunityKind[] }[] = [
  { label: "Lesson Notes", kinds: ["lesson_note", "lesson_asset"] },
  { label: "Courses", kinds: ["course"] },
  { label: "Adventures", kinds: ["adventure"] },
  { label: "Classes", kinds: ["class"] },
  { label: "MathGPL Live", kinds: ["session"] },
  { label: "Other shared material", kinds: ["asset", "background", "building", "decoration", "effect", "reward"] },
];
