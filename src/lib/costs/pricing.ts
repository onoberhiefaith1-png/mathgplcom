/**
 * Plan-shaped helpers for the admin console and plan screens.
 *
 * The money derivation itself lives in `@/lib/pricing/sellPrice` — the single
 * place credits turn into money — and is re-exported here so existing callers
 * keep one import.
 */
export { includedCredits, minorUnits, packagePrice, sellPrice } from "@/lib/pricing/sellPrice";

export type PlanAudience = "teacher" | "school" | "parent";

export type PlanRow = {
  id: string;
  key: string;
  audience: PlanAudience;
  label: string;
  subscriptionAmount: number;
  creditAmount: number;
  currency: string;
  status: "available" | "coming_soon";
  sortOrder: number;
};

/** Total monthly price: the subscription portion plus the credit portion. */
export const planTotal = (plan: Pick<PlanRow, "subscriptionAmount" | "creditAmount">) =>
  plan.subscriptionAmount + plan.creditAmount;

export const AUDIENCE_LABEL: Record<PlanAudience, string> = {
  teacher: "Teacher",
  school: "School",
  parent: "Parent",
};

/** Students never subscribe — access comes through their school or teacher. */
export const SUBSCRIBING_AUDIENCES: PlanAudience[] = ["teacher", "school", "parent"];
