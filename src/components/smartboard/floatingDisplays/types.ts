import type { ReactNode } from "react";

/** One navigation control. The handler is the SAME handler the engine has
 *  always used — variants only change how the control looks. */
export interface NavSpec {
  enabled: boolean;
  onTap: () => void;
  label: string;
}

export interface FloatingFrameProps {
  /** Chrome foreground colour resolved from the board surface. */
  chromeFg: string;
  /** Notebook checkpoint gate — dims and disables the strip. */
  frozen: boolean;
  frozenTitle: string;
  /** Already-built chip nodes (fragments, table chip, or the empty message). */
  chips: ReactNode;
  /** Optional extras rendered next to the controls (notebook checkpoint). */
  extras?: ReactNode;
  left: NavSpec;
  right: NavSpec;
  up: NavSpec;
  down: NavSpec;
  /** L1 / L2 / T7 … null when the beat has no line identity. */
  lineText: string | null;
  lineTitle?: string;
}

export type FloatingFrame = (props: FloatingFrameProps) => ReactNode;
