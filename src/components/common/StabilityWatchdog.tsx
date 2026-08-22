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

const StabilityWatchdog = () => {
  useEffect(() => {
    hydrateAppContext();
    setAppContext({ route: window.location.pathname });
    exposeStabilityDebug();
    const stopWatchdog = startWatchdog();
    const stopMonitor = startFreezeMonitor();
    const stopInteractionGuards = startInteractionResetGuards();
    return () => {
      stopWatchdog();
      stopMonitor();
      stopInteractionGuards();
    };
  }, []);

  return null;
};

export default StabilityWatchdog;
