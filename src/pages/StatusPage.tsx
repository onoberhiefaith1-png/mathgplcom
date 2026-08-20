import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { resilient, friendlyMessage } from "@/lib/net/resilient";

type Service = { name: string; status: "operational" | "degraded" | "down"; responseMs: number | null };
type Health = { status: "healthy" | "degraded" | "critical"; checkedAt: string; services: Service[] };

const LABEL: Record<string, string> = {
  frontend: "MathGPL website",
  database: "Lesson notes & classes",
  authentication: "Sign in",
  storage: "Images & videos",
  ai: "MathGPL Math Engine & Co-Pilot",
};

const HEADLINE: Record<Health["status"], string> = {
  healthy: "All MathGPL systems are working",
  degraded: "MathGPL is working, with one service running slowly",
  critical: "MathGPL is having problems right now",
};

const DOT: Record<Service["status"], string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
};

/** Public status page — plain language only, no technical detail. */
const StatusPage = () => {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const data = await resilient<Health>(
        async () => {
          const response = await fetch("/api/public/health", { cache: "no-store" });
          return (await response.json()) as Health;
        },
        { attempts: 2, timeoutMs: 8_000 },
      );
      setHealth(data);
      setError(null);
    } catch (e) {
      setError(friendlyMessage(e, "We couldn't reach MathGPL from this device."));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), 60_000);
    return () => clearInterval(timer);
  }, [check]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-foreground">MathGPL status</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A live check of the services teachers depend on. This page refreshes every minute.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <p className="text-base font-medium text-foreground">
          {error ? "We couldn't complete the check" : health ? HEADLINE[health.status] : "Checking…"}
        </p>
        {error && <p className="mt-2 text-sm text-muted-foreground">{error}</p>}

        {health && (
          <ul className="mt-5 divide-y divide-border">
            {health.services.map((service) => (
              <li key={service.name} className="flex items-center justify-between py-3">
                <span className="flex items-center gap-3 text-sm text-foreground">
                  <span className={`h-2.5 w-2.5 rounded-full ${DOT[service.status]}`} aria-hidden />
                  {LABEL[service.name] ?? service.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {service.status === "operational"
                    ? "Working"
                    : service.status === "degraded"
                      ? "Slow"
                      : "Unavailable"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void check()}
            disabled={checking}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {checking ? "Checking…" : "Check again"}
          </button>
          {health && (
            <span className="text-xs text-muted-foreground">
              Last checked {new Date(health.checkedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Seeing a “connection is not private” warning instead?{" "}
        <Link to="/help/connection" className="font-medium text-primary underline">
          Read what causes it
        </Link>
        .
      </p>

      <p className="mt-3 text-xs text-muted-foreground">
        Work you have already saved is never affected by a temporary outage, and unsaved changes stay
        on your device until the connection returns.
      </p>
    </main>
  );
};

export default StatusPage;
