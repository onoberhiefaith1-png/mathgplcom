import type { GameTestDisplay } from "@/lib/slate/types";
import type { TextStyleId } from "@/lib/slate/text3d";

export type VisibleTestRenderer = "surface" | "tiles" | "dimensional";

/**
 * The raised 3D renderers retain a Troika text object for layout, wrapping,
 * measurement and caret hit-testing. It must never contribute a second visible
 * or interactive copy of the mathematics beneath the physical letters/tiles.
 */
export const HIDDEN_3D_LAYOUT_TEXT = {
  fillOpacity: 0,
  outlineOpacity: 0,
  depthWrite: false,
  raycast: () => null,
} as const;

/**
 * Exactly one visual test implementation is visible at a time.
 * The other implementation remains in the system, but contributes no rendered
 * objects and receives no pointer interaction through WritingRegion.
 */
export const visibleTestRenderer = (
  testDisplay: GameTestDisplay | undefined,
  textStyle: TextStyleId,
): VisibleTestRenderer => {
  if (testDisplay === "surface") return "surface";
  return textStyle === "tiles" ? "tiles" : "dimensional";
};