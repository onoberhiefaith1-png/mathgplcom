/**
 * Server-side payment provider access.
 *
 * Keys never reach the browser: they are read inside the functions below, at
 * call time, from the server environment.
 */
import { createHmac, timingSafeEqual } from "crypto";

export type PaddleEnv = "sandbox" | "live";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev/paddle";

function apiKey(env: PaddleEnv) {
  const key = env === "live" ? process.env["PADDLE_LIVE_API_KEY"] : process.env["PADDLE_SANDBOX_API_KEY"];
  if (!key) throw new Error(`Missing payment provider key for ${env}`);
  return key;
}

/** Authenticated call against the provider's REST API, routed via the gateway. */
export async function paddleFetch(env: PaddleEnv, path: string, init: RequestInit = {}) {
  const connectionApiKey = apiKey(env);
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  if (!lovableApiKey) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Connection-Api-Key": connectionApiKey,
      "Lovable-API-Key": lovableApiKey,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Payment provider ${res.status}: ${await res.text()}`);
  }
  return res;
}


function webhookSecret(env: PaddleEnv) {
  const secret =
    env === "live"
      ? process.env["PAYMENTS_LIVE_WEBHOOK_SECRET"]
      : process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"];
  if (!secret) throw new Error(`Missing webhook secret for ${env}`);
  return secret;
}

export type PaddleEvent = { event_type: string; data: Record<string, unknown> };

/**
 * Verifies the provider's signature before any event is trusted. The webhook
 * route is public, so this is the only thing standing between the database and
 * a forged request.
 */
export async function verifyWebhook(request: Request, env: PaddleEnv): Promise<PaddleEvent> {
  const header = request.headers.get("paddle-signature") ?? "";
  const raw = await request.text();

  const parts = new Map(
    header.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    }),
  );
  const ts = parts.get("ts");
  const h1 = parts.get("h1");
  if (!ts || !h1) throw new Error("Missing signature");

  const expected = createHmac("sha256", webhookSecret(env)).update(`${ts}:${raw}`).digest("hex");
  const a = Buffer.from(h1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid signature");

  return JSON.parse(raw) as PaddleEvent;
}
