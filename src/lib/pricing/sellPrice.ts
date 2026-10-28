/**
 * The one place money is derived from credits.
 *
 * The administrator sets a credit cost price and a profit percentage. Every
 * customer-facing amount — plan prices, pay-as-you-go packs, checkout — is
 * calculated from those two numbers, never typed in twice.
 */

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/** Cost price + profit = what one credit sells for. */
export const sellPrice = (costPrice: number, profitPercentage: number) =>
  num(costPrice) * (1 + num(profitPercentage) / 100);

/** How many credits a plan's credit budget buys at the current price. */
export const includedCredits = (creditAmount: number, costPrice: number, profitPercentage: number) => {
  const price = sellPrice(costPrice, profitPercentage);
  if (!(price > 0)) return 0;
  return num(creditAmount) / price;
};

/** What a pay-as-you-go pack of `credits` costs today. */
export const packagePrice = (credits: number, costPrice: number, profitPercentage: number) =>
  num(credits) * sellPrice(costPrice, profitPercentage);

/** Provider amounts are whole minor units (pence). */
export const minorUnits = (amount: number) => Math.round(num(amount) * 100);
