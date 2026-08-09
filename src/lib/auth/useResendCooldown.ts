import { useCallback, useEffect, useState } from "react";

import {
  markConfirmationSent,
  resendCooldownRemaining,
  resendConfirmationEmail,
  type ResendResult,
} from "@/lib/auth/resendConfirmation";

/**
 * One resend behaviour for every account type.
 *
 * The button is only live when the cooldown has run out, the remaining seconds
 * tick down visibly, and each successful send starts a fresh minute — for ever,
 * never a one-shot action. The stamp is stored per email address in the
 * browser, so refreshing the page or opening a second tab keeps the same
 * countdown, and the authentication service applies its own hourly limit on top.
 */
export function useResendCooldown(email: string) {
  const address = email.trim();
  const [seconds, setSeconds] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const sync = () => setSeconds(address ? resendCooldownRemaining(address) : 0);
    sync();
    const timer = setInterval(sync, 1000);
    return () => clearInterval(timer);
  }, [address]);

  /** Starts the countdown for an email the platform has just sent itself. */
  const start = useCallback(() => {
    if (!address) return;
    markConfirmationSent(address);
    setSeconds(resendCooldownRemaining(address));
  }, [address]);

  const resend = useCallback(async (): Promise<ResendResult> => {
    if (!address) return { ok: false, message: "Enter your email address first." };
    setSending(true);
    const result = await resendConfirmationEmail(address);
    setSending(false);
    setSeconds(resendCooldownRemaining(address));
    return result;
  }, [address]);

  return { seconds, sending, resend, start, ready: seconds === 0 };
}
