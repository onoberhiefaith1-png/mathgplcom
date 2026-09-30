/**
 * SMARTBOARD NATIVE-KEYBOARD RULE.
 *
 * One source of truth for "the device keyboard must not open inside the
 * Smartboard". On a phone or tablet the native keyboard covers half of the
 * mathematical workspace, and the board already provides its own number,
 * symbol and fraction keys — so it is suppressed there for every role
 * (teacher, student, guest, presenter).
 *
 * Desktop and laptop keep full physical-keyboard behaviour, and this hook is
 * imported ONLY by Smartboard surfaces: login, names, search, lesson notes and
 * every other form in the app are untouched.
 */
import { useEffect, useState } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";

export function useBoardNativeKeyboard(): boolean {
  const bp = useBreakpoint();
  // Width alone is not a device: a narrow laptop window still has a physical
  // keyboard and needs Backspace/Enter/Tab. Only suppress on touch devices.
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse) and (hover: none)");
    const sync = () => setTouch(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  return bp !== "desktop" && touch;
}
