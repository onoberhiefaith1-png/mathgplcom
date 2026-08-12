/**
 * The platform's credit pricing formula, shared by the admin console and the
 * plan screens so a percentage change moves every derived figure at once.
 *
 * Credits are the internal accounting unit. Money only appears when a value
 * has to be displayed or collected.
 */

/** Cost price + profit = what one credit sells for. */
export const sellPrice = (costPrice: number, profitPercentage: number) =>
  (Number.isFinite(costPrice) ? costPrice : 0) * (1 + (Number.isFinite(profitPercentage) ? profitPercentage : 0) / 100);

/** How many credits a plan's credit-value portion buys at the current price. */
export const includedCredits = (creditAmount: number, costPrice: number, profitPercentage: number) => {
  const price = sellPrice(costPrice, profitPercentage);
  if (!(price > 0)) return 0;
  return (Number.isFinite(creditAmount) ? creditAmount : 0) / price;
};

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
