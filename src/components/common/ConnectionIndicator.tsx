import { useConnectionStatus } from "@/lib/status/useConnectionStatus";

/**
 * Subtle global connection pill. Silent while everything is fine so it never
 * distracts, visible the moment a teacher's network drops.
 */
const ConnectionIndicator = () => {
  const state = useConnectionStatus();
  if (state === "online") return null;

  const offline = state === "offline";
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur"
    >
      {offline
        ? "Offline — your changes are stored on this device"
        : "Reconnecting… your work is safe"}
    </div>
  );
};

export default ConnectionIndicator;
