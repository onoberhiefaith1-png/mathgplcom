/**
 * Edge-function usage meter.
 *
 * Wraps a request in an accounting context, transparently reads token usage
 * off every AI gateway response made inside it, and flushes one usage event
 * per metric to `record_usage_event`. The database prices it and rolls it into
 * the caller's Cost Unit — nothing here decides prices or who pays.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "npm:@supabase/supabase-js@2";

type Ctx = {
  userId: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
  images: number;
  audioMinutes: number;
  egressBytes: number;
  model: string | null;
};

const als = new AsyncLocalStorage<Ctx>();
let patched = false;

const AI_HOSTS = ["ai.gateway.lovable.dev", "api.openai.com", "api.elevenlabs.io", "generativelanguage.googleapis.com"];

function isAiUrl(url: string) {
  return AI_HOSTS.some((host) => url.includes(host));
}

function patchFetch() {
  if (patched) return;
  patched = true;
  const original = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    const response = await original(input, init);
    const ctx = als.getStore();
    if (!ctx) return response;

    const url = typeof input === "string" ? input : input?.url ?? "";
    if (!isAiUrl(String(url))) return response;

    const type = response.headers.get("content-type") ?? "";
    if (!response.ok) return response;

    try {
      if (type.includes("application/json")) {
        const clone = response.clone();
        const json: any = await clone.json();
        const usage = json?.usage ?? {};
        ctx.tokensIn += Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
        ctx.tokensOut += Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
        if (Array.isArray(json?.data)) ctx.images += json.data.length;
        if (typeof json?.model === "string") ctx.model = json.model;
      } else if (type.startsWith("audio/") || type.startsWith("image/")) {
        const bytes = Number(response.headers.get("content-length") ?? 0);
        if (type.startsWith("image/")) ctx.images += 1;
        else if (bytes > 0) ctx.audioMinutes += bytes / (16_000 * 60); // ~16 kB per audio second
        ctx.egressBytes += bytes;
      }
    } catch {
      // Never let accounting interfere with the customer's response.
    }
    return response;
  };
}

async function flush(ctx: Ctx, elapsedMs: number) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;

  const events: { category: string; metric: string; quantity: number; unit: string }[] = [
    { category: "compute", metric: "compute.invocations", quantity: 1, unit: "invocation" },
    { category: "compute", metric: "compute.gb_seconds", quantity: (elapsedMs / 1000) * 0.25, unit: "GB-second" },
  ];
  if (ctx.tokensIn > 0)
    events.push({ category: "ai", metric: "ai.input_tokens", quantity: ctx.tokensIn / 1_000_000, unit: "million tokens" });
  if (ctx.tokensOut > 0)
    events.push({ category: "ai", metric: "ai.output_tokens", quantity: ctx.tokensOut / 1_000_000, unit: "million tokens" });
  if (ctx.images > 0) events.push({ category: "ai", metric: "ai.images", quantity: ctx.images, unit: "image" });
  if (ctx.audioMinutes > 0)
    events.push({ category: "ai", metric: "ai.audio_minutes", quantity: ctx.audioMinutes, unit: "minute" });
  if (ctx.egressBytes > 0)
    events.push({ category: "network", metric: "network.egress_gb", quantity: ctx.egressBytes / 1_073_741_824, unit: "GB" });

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: profile } = await admin
    .from("profiles")
    .select("active_org_id")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  for (const event of events) {
    try {
      await admin.rpc("record_usage_event", {
        _user_id: ctx.userId,
        _org_id: profile?.active_org_id ?? null,
        _category: event.category,
        _metric: event.metric,
        _quantity: event.quantity,
        _unit: event.unit,
        _feature: ctx.feature,
        _model: ctx.model,
      });
    } catch (error) {
      console.error("[costs] record_usage_event failed", error);
    }
  }
}

/** Run a handler with metering; the handler's own result is returned untouched. */
export async function withUsageMeter<T>(
  userId: string | null | undefined,
  feature: string,
  handler: () => Promise<T>,
): Promise<T> {
  if (!userId) return handler();
  patchFetch();
  const ctx: Ctx = {
    userId,
    feature,
    tokensIn: 0,
    tokensOut: 0,
    images: 0,
    audioMinutes: 0,
    egressBytes: 0,
    model: null,
  };
  const started = Date.now();
  try {
    return await als.run(ctx, handler);
  } finally {
    const elapsed = Date.now() - started;
    // Do not make the customer wait for accounting.
    void flush(ctx, elapsed).catch(() => {});
  }
}

/** The user id inside a bearer token. Accounting only — the handler still verifies it. */
function subjectOf(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json?.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

/**
 * Meters and gates a whole edge function with one line at the top of the file:
 *   meterFunction("notebook-ai");
 * It wraps whatever handler the function later hands to Deno.serve, so the
 * function's own code is untouched. Credits are reserved before the handler
 * runs and released afterwards; an account that cannot pay is refused here,
 * on the server, before any chargeable work happens.
 */
export function meterFunction(feature: string, estimatedCredits = 0.5) {
  const serve = Deno.serve.bind(Deno) as (...args: any[]) => any;
  (Deno as any).serve = (...args: any[]) => {
    const index = args.findIndex((a) => typeof a === "function");
    if (index < 0) return serve(...args);
    const handler = args[index];
    args[index] = async (request: Request, info: unknown) => {
      const userId = subjectOf(request);
      if (!userId || request.method === "OPTIONS") return handler(request, info);

      const gate = await openCreditGate(userId, feature, estimatedCredits);
      if (!gate.allowed) return creditBlockedResponse(gate);

      try {
        return await withUsageMeter(userId, feature, () => handler(request, info));
      } finally {
        void closeCreditGate(gate.operationKey).catch(() => {});
      }
    };
    return serve(...args);
  };
}


