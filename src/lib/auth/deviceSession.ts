/**
 * Signed in through an installed app (Mathemagine or Academia) means signed in
 * on THIS device until the person taps Log out: no "15 minutes away" sign-out,
 * and no "Remember me" browser-session sign-out when the app is reopened.
 *
 * The mark lives in localStorage (shared by the app window and the browser on
 * desktop, because both use the same site storage) and is removed by the one
 * sign-out routine, so an explicit Log out always ends it.
 */
import { isStandaloneWindow } from "@/lib/install/appInstallPages";

export const DEVICE_SESSION_KEY = "mathgpl.deviceSession";

/** Called once a session exists: an installed-app window marks the sign-in as kept on this device. */
export function markDeviceSessionIfApp(storage?: Storage): void {
  if (typeof window === "undefined" || !isStandaloneWindow()) return;
  try { (storage ?? window.localStorage).setItem(DEVICE_SESSION_KEY, "1"); } catch { /* private mode */ }
}

/** True in an installed app's window, or after signing in through one on this device. */
export function keepsDeviceSession(storage?: Storage): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneWindow()) return true;
  try { return (storage ?? window.localStorage).getItem(DEVICE_SESSION_KEY) === "1"; } catch { return false; }
}
