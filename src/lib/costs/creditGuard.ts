import { fetchCreditHeadroom } from "./costs.functions";

/**
 * A courtesy check so the interface can explain the situation before a user
 * starts something they cannot finish. It is never the enforcement point:
 * the server refuses the operation itself if credits are short.
 */
export async function hasCreditsForGeneration(estimated = 0.05): Promise<boolean> {
  try {
    const head = await fetchCreditHeadroom();
    if (!head.enforced) return true;
    if (!head.aiAllowed) return false;
    if (!head.canStart) return false;
    return head.available >= estimated;
  } catch {
    return true; // Accounting must never break a lesson.
  }
}

/** The credit position for display: balance, held, spendable. */
export async function creditPosition() {
  try {
    return await fetchCreditHeadroom();
  } catch {
    return null;
  }
}

export const INSUFFICIENT_CREDITS_MESSAGE =
  "You have run out of credits. Top up your balance to keep generating.";

export const NO_AI_PLAN_MESSAGE = "AI generation is part of a paid plan. Upgrade your plan to generate.";
