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

const API = "https://api.stripe.com";

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
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    disabled_reason?: string | null;
  } | null;
};

/**
 * Is MathGPL itself ready to act as a Connect platform? Asked before we try to
 * create a teacher's account, so the owner meets one honest sentence instead of
 * Stripe's platform plumbing.
 */
export const platformReadiness = async (): Promise<{ ready: boolean; reason: string | null }> => {
  const account = await stripeRequest<StripeAccount & { capabilities?: Record<string, string> }>("/v1/account");
  if (!account.details_submitted) {
    return { ready: false, reason: "platform account has not submitted its business details" };
  }
  if (!account.charges_enabled) {
    return { ready: false, reason: "platform account cannot accept charges yet" };
  }
  return { ready: true, reason: null };
};

export const PLATFORM_NOT_READY =
  "Payments are not finished setting up on the MathGPL platform yet. Please contact support.";

/**
 * Stripe's v2 API, used for account creation and onboarding links. Stripe no
 * longer accepts v1 connected-account creation for new platforms, so this is
 * the current path; v1 remains in use for reading account state.
 */
const V2_VERSION = "2025-11-17.preview";

const stripeV2Request = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      "Stripe-Version": V2_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Stripe v2 request failed [${response.status}] ${path}: ${text}`);
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: { user_message?: string; message?: string } };
      message = parsed.error?.user_message ?? parsed.error?.message ?? text;
    } catch {
      /* keep raw text */
    }
    throw new Error(`Stripe: ${message}`);
  }

  return (await response.json()) as T;
};

/**
 * Creates the workspace owner's own Stripe account.
 *
 * The account is created with Stripe's own hosted onboarding and dashboard, and
 * with Stripe collecting its processing fee from that account — MathGPL never
 * takes a cut and never sees banking or identity details.
 */
export const createConnectedAccount = async (input: {
  email: string | null;
  ownerKind: string;
  ownerId: string;
  displayName?: string | null;
  country?: string;
}): Promise<StripeAccount> => {
  const country = (input.country ?? "GB").toLowerCase();
  const account = await stripeV2Request<{ id: string }>("/v2/core/accounts", {
    contact_email: input.email ?? undefined,
    display_name: input.displayName ?? undefined,
    dashboard: "full",
    identity: { country },
    defaults: {
      currency: country === "gb" ? "gbp" : undefined,
      // Stripe bills its processing fee to the connected account, and MathGPL
      // adds no application fee anywhere.
      responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
    },
    configuration: {
      merchant: { capabilities: { card_payments: { requested: true } } },
    },
    include: ["configuration.merchant", "requirements"],
    metadata: { mathgpl_owner_id: input.ownerId, mathgpl_owner_kind: input.ownerKind },
  });

  // Read the freshly created account through v1 so callers get one shape.
  return retrieveAccount(account.id);
};

export const retrieveAccount = (accountId: string) =>
  stripeRequest<StripeAccount & { type?: string }>(`/v1/accounts/${accountId}`);

/**
 * A fresh Stripe-hosted onboarding link, generated per owner on every click.
 * Links are short-lived by design, so none of them is ever stored.
 */
export const createAccountLink = async (
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<{ url: string }> => {
  const link = await stripeV2Request<{ url: string }>("/v2/core/account_links", {
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant"],
        refresh_url: refreshUrl,
        return_url: returnUrl,
      },
    },
  });
  return { url: link.url };
};

/**
 * Where the owner manages their money. Express accounts need a Stripe-issued
 * login link; accounts with their own full dashboard simply sign in to Stripe.
 */
export const createLoginLink = async (accountId: string): Promise<{ url: string }> => {
  const account = await retrieveAccount(accountId);
  if (account.type === "express") {
    return stripeRequest<{ url: string }>(`/v1/accounts/${accountId}/login_links`, {
      method: "POST",
    });
  }
  return { url: "https://dashboard.stripe.com/" };
};


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
  recurringInterval?: "month" | "year";
}) =>
  stripeRequest<{ id: string; url: string }>("/v1/checkout/sessions", {
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
            ...(input.mode === "subscription" ? { recurring: { interval: input.recurringInterval ?? "month" } } : {}),
          },
        },
      ],
      metadata: input.metadata,
      ...(input.mode === "subscription" ? { subscription_data: { metadata: input.metadata } } : {}),
    },
  });
