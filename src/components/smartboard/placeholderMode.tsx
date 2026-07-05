// PlaceholderMode — controls how MathTreeRender paints an *empty* sub-slot
// (numerator/denominator, radicand, exponent, matrix cell, etc.).
//
// - "visible" (default): full-strength black dashed cube, as designed for
//   the Floating Number panel, the Present preview, and the lesson-note
//   generation page. Nothing changes on those surfaces.
// - "blend":  the slot renders as an *invisible* inline span of the same
//   intrinsic size and same tap behavior. Used only inside the live
//   smartboard writing surface, so idle placeholders vanish into the
//   textured board while the structure and click-target survive.
//
// The active (caret-parked) slot still shows a soft caret-color glow in
// both modes so the teacher can see where the sensor sits.

import { createContext, useContext, type ReactNode } from "react";

export type PlaceholderMode = "visible" | "blend";

const PlaceholderModeContext = createContext<PlaceholderMode>("visible");

export const PlaceholderModeProvider = ({
  value,
  children,
}: {
  value: PlaceholderMode;
  children: ReactNode;
}) => (
  <PlaceholderModeContext.Provider value={value}>
    {children}
  </PlaceholderModeContext.Provider>
);

export const usePlaceholderMode = (): PlaceholderMode =>
  useContext(PlaceholderModeContext);
