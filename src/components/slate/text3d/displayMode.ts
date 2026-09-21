import type { GameTestDisplay } from "@/lib/slate/types";
import type { TextStyleId } from "@/lib/slate/text3d";

export type VisibleTestRenderer = "surface" | "tiles" | "dimensional";

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