import { useEffect, useState } from "react";

export type ConnectionState = "online" | "reconnecting" | "offline";

/**
 * Real connection state for the global indicator.
 *
 * `navigator.onLine` alone lies on captive/school networks, so a lost
 * connection is confirmed with a cheap ping against the public health
 * endpoint before the teacher is told they are offline.
 */
export function useConnectionStatus(): ConnectionState {
  const [state, setState] = useState<ConnectionState>("online");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const ping = async (): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const abort = setTimeout(() => controller.abort(), 5_000);
        const response = await fetch("/api/public/health", {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(abort);
        return response.ok || response.status === 503;
      } catch {
        return false;
      }
    };

    const confirm = async () => {
      if (cancelled) return;
      setState((prev) => (prev === "online" ? "reconnecting" : prev));
      const reachable = await ping();
      if (cancelled) return;
      if (reachable) {
        setState("online");
        return;
      }
      setState("offline");
      timer = setTimeout(confirm, 10_000);
    };

    const onOffline = () => void confirm();
    const onOnline = () => void confirm();

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (navigator.onLine === false) void confirm();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return state;
}
