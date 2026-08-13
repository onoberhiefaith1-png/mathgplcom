/**
 * Stripe Connect, seen from the platform side.
 *
 * MathGPL never holds a teacher's or a school's money. Each workspace owner is
 * onboarded as their own Stripe connected account and every charge is created
 * directly on that account with no application fee, so the full amount — less
 * Stripe's own processing fee, charged to them by Stripe — settles into their
 * account. The platform key here exists only to create the connection and to
 * open Checkout on their behalf.
 */

const API = "https://api.stripe.com/v1";

const secretKey = (): string => {
  const key = process.env["STRIPE_CONNECT_SECRET_KEY"];
  if (!key) throw new Error("Stripe is not configured on this platform yet.");
  return key;
};

/** Stripe's API is form-encoded, including nested objects and arrays. */
const encode = (value: unknown, prefix = "", out = new URLSearchParams()): URLSearchParams => {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => encode(entry, `${prefix}[${index}]`, out));
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      encode(entry, prefix ? `${prefix}[${key}]` : key, out);
    }
    return out;
  }
  out.append(prefix, String(value));
  return out;
};

export const stripeRequest = async <T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown>; stripeAccount?: string } = {},
): Promise<T> => {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey()}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (options.stripeAccount) headers["Stripe-Account"] = options.stripeAccount;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: options.body ? encode(options.body).toString() : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Stripe request failed [${response.status}] ${path}: ${text}`);
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
    } catch {
      /* keep raw text */
    }
    // A teacher should never meet Stripe's platform plumbing. This particular
    // failure means MathGPL itself has not finished signing up for Connect.
    if (/signed up for Connect|sign up for Connect/i.test(message)) {
      throw new Error(
        "Payments are not finished setting up on the MathGPL platform yet. Please contact support.",
      );
    }
    throw new Error(`Stripe: ${message}`);
  }

  return (await response.json()) as T;
};

export type StripeAccount = {
  id: string;
  charges_enabled: boolean;
  details_submitted: boolean;
};

export const createConnectedAccount = async (input: {
  email: string | null;
  ownerKind: string;
  ownerId: string;
  country?: string;
}): Promise<StripeAccount> =>
  stripeRequest<StripeAccount>("/accounts", {
    method: "POST",
    body: {
      type: "express",
      country: input.country ?? "GB",
      email: input.email ?? undefined,
      business_type: input.ownerKind === "school" ? "company" : undefined,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { mathgpl_owner_id: input.ownerId, mathgpl_owner_kind: input.ownerKind },
    },
  });

export const retrieveAccount = (accountId: string) =>
  stripeRequest<StripeAccount>(`/accounts/${accountId}`);

export const createAccountLink = (accountId: string, refreshUrl: string, returnUrl: string) =>
  stripeRequest<{ url: string }>("/account_links", {
    method: "POST",
    body: {
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    },
  });

export const createLoginLink = (accountId: string) =>
  stripeRequest<{ url: string }>(`/accounts/${accountId}/login_links`, { method: "POST" });

export const createDirectCheckoutSession = (input: {
  stripeAccount: string;
  mode: "payment" | "subscription";
  amountMinor: number;
  currency: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail: string | null;
  metadata: Record<string, string>;
}) =>
  stripeRequest<{ id: string; url: string }>("/checkout/sessions", {
    method: "POST",
    stripeAccount: input.stripeAccount,
    body: {
      mode: input.mode,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail ?? undefined,
      // No application_fee_amount and no transfer_data: the platform takes £0.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountMinor,
            product_data: { name: input.productName },
            ...(input.mode === "subscription" ? { recurring: { interval: "month" } } : {}),
          },
        },
      ],
      metadata: input.metadata,
      ...(input.mode === "subscription" ? { subscription_data: { metadata: input.metadata } } : {}),
    },
  });
