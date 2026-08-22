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

const StabilityWatchdog = () => {
  useEffect(() => {
    hydrateAppContext();
    setAppContext({ route: window.location.pathname });
    exposeStabilityDebug();
    const stopWatchdog = startWatchdog();
    const stopMonitor = startFreezeMonitor();
    return () => {
      stopWatchdog();
      stopMonitor();
    };
  }, []);

  return null;
};

export default StabilityWatchdog;
