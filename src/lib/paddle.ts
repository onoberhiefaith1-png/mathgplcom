import { resolvePaddlePrice } from "@/utils/payments.functions";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

declare global {
  interface Window {
    Paddle: any;
  }
}

/** Which payment environment the browser is in, derived from the token. */
export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let paddleInitialized = false;

export async function initializePaddle() {
  if (paddleInitialized) return;
  if (!clientToken) throw new Error("Payments are not configured.");

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
      window.Paddle.Initialize({ token: clientToken });
      paddleInitialized = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  return resolvePaddlePrice({ data: { priceId, environment: getPaddleEnvironment() } });
}

export type BillingInterval = "monthly" | "yearly";

/**
 * Each paid plan sells through two prices keyed off the plan: the monthly
 * amount the administrator published, and the yearly amount (12 months less
 * the 20% yearly discount).
 */
export const priceKeyForPlan = (planKey: string, interval: BillingInterval = "monthly") =>
  `${planKey}_${interval}`;

/** The yearly discount every paid plan carries. */
export const YEARLY_DISCOUNT = 0.2;

/** 12 months of the monthly price, less the yearly discount. */
export const yearlyPriceOf = (monthly: number) =>
  Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT) * 100) / 100;

/** What 12 months would cost without the yearly discount. */
export const standardAnnualPriceOf = (monthly: number) => Math.round(monthly * 12 * 100) / 100;
