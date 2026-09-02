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
import { useBreakpoint } from "@/hooks/useBreakpoint";

export function useBoardNativeKeyboard(): boolean {
  return useBreakpoint() !== "desktop";
}
