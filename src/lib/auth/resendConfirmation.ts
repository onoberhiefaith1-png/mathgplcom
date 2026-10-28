/**
 * Re-sends the one real signup confirmation email.
 *
 * This goes through the platform's own authentication provider, so the link in
 * the email is a genuine, freshly minted confirmation token and the message is
 * the existing branded MathGPL "Confirm Your Account" email. Nothing here
 * mints tokens or composes email of its own.
 */
import { supabase } from "@/integrations/supabase/client";

const COOLDOWN_MS = 60_000;
const KEY = "mathgpl:lastConfirmationResend";

export type ResendResult =
  | { ok: true }
  | { ok: false; message: string; retryInSeconds?: number };

function lastSentAt(email: string): number {
  try {
    const raw = localStorage.getItem(`${KEY}:${email.toLowerCase()}`);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Records that a confirmation email has just gone out for this address, so the
 * cooldown also covers the very first email sent by signing up. The stamp lives
 * in the browser's own storage, which survives a refresh and is shared by every
 * open tab, so the countdown cannot be skipped by reloading the page.
 */
export function markConfirmationSent(email: string) {
  markSent(email.trim());
}

function markSent(email: string) {
  try {
    localStorage.setItem(`${KEY}:${email.toLowerCase()}`, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Seconds remaining before another confirmation email may be requested. */
export function resendCooldownRemaining(email: string): number {
  const elapsed = Date.now() - lastSentAt(email);
  if (elapsed >= COOLDOWN_MS) return 0;
  return Math.ceil((COOLDOWN_MS - elapsed) / 1000);
}

export async function resendConfirmationEmail(email: string): Promise<ResendResult> {
  const address = email.trim();
  if (!address) return { ok: false, message: "Enter your email address first." };

  const wait = resendCooldownRemaining(address);
  if (wait > 0) {
    return {
      ok: false,
      message: `Please wait ${wait} second${wait === 1 ? "" : "s"} before requesting another email.`,
      retryInSeconds: wait,
    };
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: address,
    options: { emailRedirectTo: `${window.location.origin}/auth/verified` },
  });

  if (error) {
    if (/rate limit|too many|429/i.test(error.message)) {
      return {
        ok: false,
        message: "Too many requests just now. Please wait a few minutes and try again.",
      };
    }
    if (/already confirmed/i.test(error.message)) {
      return { ok: false, message: "This email address is already confirmed — you can log in." };
    }
    return { ok: false, message: "We could not send the email just now. Please try again shortly." };
  }

  markSent(address);
  return { ok: true };
}
