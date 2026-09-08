/**
 * MOBILE STUDENT SMARTBOARD MODE.
 *
 * One source of truth for "this is a student (or guest) solving on a phone or
 * tablet". The board itself is never shrunk: the phone becomes a viewport that
 * pans across the full-size Smartboard. Desktop and every teacher surface keep
 * the existing behaviour untouched, because every mobile-only branch reads
 * this single flag.
 */
import { useBreakpoint } from "@/hooks/useBreakpoint";

export interface MobileBoardMode {
  /** Student/guest on a phone or tablet — compact chrome. */
  active: boolean;
  /** Phone only (the tightest layout: stacked number line, hidden extras). */
  phone: boolean;
  /**
   * Minimum board width (px). ALWAYS 0: the board must fit the available
   * viewport width, so nothing is ever pushed off-screen horizontally.
   */
  boardWidth: number;
}

/** No forced board width — content reflows to the viewport instead. */
export const MOBILE_BOARD_MIN_WIDTH = 0;
export const TABLET_BOARD_MIN_WIDTH = 0;

export function useMobileStudentBoard(role: "teacher" | "student"): MobileBoardMode {
  const bp = useBreakpoint();
  const phone = bp === "phone";
  const active = role === "student" && (phone || bp === "tablet");
  return { active, phone, boardWidth: 0 };
}
