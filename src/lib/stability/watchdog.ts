/**
 * Application watchdog.
 *
 * A single heartbeat for the whole app. It checks that the network is
 * reachable, that the realtime socket is connected, that the session is still
 * valid, and that no registered operation has outlived its budget. When it
 * finds a problem it recovers silently — reconnect, re-auth, resync — and
 * never reloads the page.
 */
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { releaseResource, trackResource } from "./registry";

export type WatchdogHealth = {
  network: boolean;
  realtime: boolean;
  session: boolean;
  stuckOperations: string[];
  at: number;
};

type Operation = { label: string; startedAt: number; budgetMs: number; onStuck?: () => void; resourceId: number };

const operations = new Map<string, Operation>();
const resyncers = new Set<() => void>();
let health: WatchdogHealth = { network: true, realtime: true, session: true, stuckOperations: [], at: 0 };
const healthListeners = new Set<(next: WatchdogHealth) => void>();

/** Register a long-running operation so the watchdog can notice if it hangs. */
export function beginOperation(id: string, label: string, budgetMs = 60_000, onStuck?: () => void): void {
  const existing = operations.get(id);
  if (existing) releaseResource(existing.resourceId);
  operations.set(id, { label, startedAt: Date.now(), budgetMs, onStuck, resourceId: trackResource("operation", label) });
}

export function endOperation(id: string): void {
  const existing = operations.get(id);
  if (!existing) return;
  releaseResource(existing.resourceId);
  operations.delete(id);
}

/** Called after a recovery so a screen can pull the latest server state. */
export function registerResync(resync: () => void): () => void {
  resyncers.add(resync);
  return () => resyncers.delete(resync);
}

export function subscribeHealth(listener: (next: WatchdogHealth) => void): () => void {
  healthListeners.add(listener);
  return () => healthListeners.delete(listener);
}

export function currentHealth(): WatchdogHealth {
  return health;
}

function publish(next: WatchdogHealth) {
  health = next;
  for (const listener of healthListeners) listener(next);
}

async function reachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), 6_000);
    const response = await fetch("/api/public/health", { cache: "no-store", signal: controller.signal });
    clearTimeout(abort);
    return response.ok || response.status === 503;
  } catch {
    return false;
  }
}

function realtimeConnected(): boolean {
  try {
    return supabase.realtime.isConnected();
  } catch {
    return true; // Unknown is not a failure.
  }
}

async function sessionValid(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return true; // Signed out is a valid state, not a fault.
    const expiresAt = (data.session.expires_at ?? 0) * 1_000;
    return expiresAt === 0 || expiresAt > Date.now();
  } catch {
    return false;
  }
}

let backoffStep = 0;

async function beat() {
  if (typeof document !== "undefined" && document.hidden) return;

  const stuck: string[] = [];
  const now = Date.now();
  for (const [id, op] of operations) {
    if (now - op.startedAt > op.budgetMs) {
      stuck.push(op.label);
      op.onStuck?.();
      endOperation(id);
    }
  }

  const network = navigator.onLine === false ? false : await reachable();
  const realtime = realtimeConnected();
  const session = await sessionValid();

  publish({ network, realtime, session, stuckOperations: stuck, at: now });

  const unhealthy = !network || !realtime || !session;
  if (!unhealthy) {
    if (backoffStep > 0) {
      // We just came back: pull fresh server state into whatever is on screen.
      backoffStep = 0;
      for (const resync of resyncers) {
        try {
          resync();
        } catch (error) {
          console.warn("[watchdog] resync failed", error);
        }
      }
    }
    return;
  }

  backoffStep = Math.min(backoffStep + 1, 6);
  try {
    if (!session) await supabase.auth.refreshSession();
    if (!realtime) {
      await ensureRealtimeAuth();
      supabase.realtime.connect();
    }
  } catch (error) {
    console.warn("[watchdog] recovery attempt failed", error);
  }
}

let stopFn: (() => void) | null = null;

/** Start the heartbeat. Idempotent; returns a cleanup function. */
export function startWatchdog(intervalMs = 15_000): () => void {
  if (stopFn) return stopFn;
  let timer: number | undefined;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await beat();
    } finally {
      running = false;
    }
  };

  const scheduleDelay = () => (backoffStep > 0 ? Math.min(intervalMs, 2_000 * 2 ** (backoffStep - 1)) : intervalMs);

  const loop = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      await tick();
      loop();
    }, scheduleDelay());
  };

  void tick();
  loop();

  const onOnline = () => void tick();
  window.addEventListener("online", onOnline);

  stopFn = () => {
    window.clearTimeout(timer);
    window.removeEventListener("online", onOnline);
    stopFn = null;
  };
  return stopFn;
}
