/**
 * Bold subject-card gradients for the hub tiles closest to Faith's five features.
 *
 * Mapping (product ask → existing surface):
 * - Connect to School → Teaching Hub Academia tile, Parent "Connect to a school", Student "My Schools"
 * - Student Class → Teaching Hub Classes, Student "My Classes"
 * - Assign → Student "Assignments", Academia Session "Assign"
 * - Lesson Notes → Teaching Hub Lesson Notes, Academia Session "Note"
 * - Smart Board → Teaching Hub SmartBoard, Academia Session "Smartboard"
 *
 * Game and Adventure share the same row, so they get their own gradients too.
 */
export type FeatureCard = "school" | "class" | "assign" | "notes" | "board" | "game" | "adventure";

export const FEATURE_CARD_CLASS = "feature-card";
