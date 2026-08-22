/**
 * Mounts the application stability layer exactly once.
 *
 * Silent by design: the only user-visible surface is the existing connection
 * pill. No reloads, no technical text.
 */
import { useEffect } from "react";
import { startWatchdog } from "@/lib/stability/watchdog";
import { startFreezeMonitor } from "@/lib/stability/freezeMonitor";
import { exposeStabilityDebug } from "@/lib/stability/registry";
import { hydrateAppContext, setAppContext } from "@/lib/stability/appContext";
import { startInteractionResetGuards } from "@/lib/stability/interactionReset";
import { startOverlayGuard } from "@/lib/stability/overlayGuard";

const StabilityWatchdog = () => {
  useEffect(() => {
    hydrateAppContext();
    setAppContext({ route: window.location.pathname });
    exposeStabilityDebug();
    const stopWatchdog = startWatchdog();
    const stopMonitor = startFreezeMonitor();
    const stopInteractionGuards = startInteractionResetGuards();
    const stopOverlayGuard = startOverlayGuard();
    return () => {
      stopWatchdog();
      stopMonitor();
      stopInteractionGuards();
      stopOverlayGuard();
    };
  }, []);

  return null;
};

export default StabilityWatchdog;
