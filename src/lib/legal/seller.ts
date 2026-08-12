/**
 * The single place the public-facing seller identity lives.
 *
 * Paddle's readiness review requires the legal seller to be named on the
 * Terms, Privacy and Refund pages, and requires the Merchant of Record
 * disclosure to appear verbatim. Change these values here and every policy
 * page, the footer and the support page follow.
 */

/** Legal seller as configured in the payment account (sole proprietor). */
export const SELLER_LEGAL_NAME = "Onoberhie Faith";

/** Public product / brand name. */
export const BRAND = "MathGPL";

/** Official support contact. */
export const SUPPORT_EMAIL = "support@mathgpl.com";

/** Where buyers manage payments, invoices and refunds. */
export const PADDLE_BUYER_SUPPORT = "https://paddle.net";
export const PADDLE_BUYER_TERMS = "https://www.paddle.com/legal/checkout-buyer-terms";

/** Paddle requires this disclosure, substantially unchanged. */
export const MERCHANT_OF_RECORD_STATEMENT =
  "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides payment processing, customer service support for payment transactions, and handles applicable returns and refunds.";

export const POLICY_EFFECTIVE_DATE = "12 August 2026";
export const POLICY_UPDATED_DATE = "12 August 2026";

/** Change-of-mind window for eligible purchases. */
export const REFUND_WINDOW_DAYS = 30;
