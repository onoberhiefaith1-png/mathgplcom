import { useState } from "react";
import { getPaddleEnvironment, getPaddlePriceId, initializePaddle } from "@/lib/paddle";
import { verifyCheckoutPrice } from "@/lib/plans/plans.functions";

/** Opens the hosted checkout overlay for a plan price. */
export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    quantity?: number;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();

      // Never charge an amount that disagrees with the published plan.
      const check = await verifyCheckoutPrice({
        data: { priceId: options.priceId, environment: getPaddleEnvironment() },
      });
      if (!check.ok) {
        throw new Error("This plan is being updated. Please try again shortly.");
      }

      const paddlePriceId = await getPaddlePriceId(options.priceId);

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: options.quantity ?? 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/plans?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
