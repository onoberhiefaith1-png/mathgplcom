import { createFileRoute } from "@tanstack/react-router";

/**
 * Public health endpoint for external uptime monitoring.
 *
 * Deliberately cheap and dependency-light: shallow probes only, never any
 * internal error text, never any user data. Overall status is:
 *   healthy  — everything reachable
 *   degraded — a non-critical service (AI) is unreachable
 *   critical — the app cannot be used safely (database or auth down)
 */

type ServiceState = "operational" | "degraded" | "down";

type ServiceReport = {
  name: string;
  status: ServiceState;
  responseMs: number | null;
  critical: boolean;
};

const PROBE_TIMEOUT_MS = 8_000;
const PROBE_ATTEMPTS = 2;

async function attempt(url: string, init?: RequestInit): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One slow first request (cold connection) must never look like an outage, so
 * every probe gets a second chance before it is reported as down.
 */
async function probe(
  name: string,
  critical: boolean,
  url: string,
  init?: RequestInit,
): Promise<ServiceReport> {
  const started = Date.now();
  let status: number | null = null;
  for (let i = 0; i < PROBE_ATTEMPTS; i += 1) {
    status = await attempt(url, init);
    // 4xx still proves the service answered; only 5xx / network failures matter.
    if (status !== null && status < 500) break;
  }
  return {
    name,
    critical,
    responseMs: Date.now() - started,
    status: status !== null && status < 500 ? "operational" : "down",
  };
}

function overall(services: ServiceReport[]): "healthy" | "degraded" | "critical" {
  if (services.some((s) => s.critical && s.status === "down")) return "critical";
  if (services.some((s) => s.status !== "operational")) return "degraded";
  return "healthy";
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
        const key =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
          "";

        const services: ServiceReport[] = [
          { name: "frontend", status: "operational", responseMs: 0, critical: true },
        ];

        if (supabaseUrl) {
          const headers = { apikey: key };
          const [database, auth, storage] = await Promise.all([
            probe("database", true, `${supabaseUrl}/rest/v1/`, { headers }),
            probe("authentication", true, `${supabaseUrl}/auth/v1/health`, { headers }),
            probe("storage", false, `${supabaseUrl}/storage/v1/version`, { headers }),
          ]);
          services.push(database, auth, storage);
        } else {
          services.push({
            name: "database",
            status: "down",
            responseMs: null,
            critical: true,
          });
        }

        services.push(
          await probe("ai", false, "https://ai.gateway.lovable.dev/v1/models", {
            method: "GET",
          }),
        );

        const status = overall(services);
        return new Response(
          JSON.stringify({
            status,
            checkedAt: new Date().toISOString(),
            services: services.map(({ name, status: s, responseMs }) => ({
              name,
              status: s,
              responseMs,
            })),
          }),
          {
            // Always 200: this endpoint reports on other services and must not
            // itself look like a failing page. Read `status` in the body.
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
            },
          },
        );
      },
    },
  },
});
