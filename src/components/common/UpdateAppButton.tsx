import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, LoaderCircle, RefreshCw, WifiOff, X } from "lucide-react";
import {
  checkForAppUpdate,
  applyAppUpdate,
  runUpdateApp,
  takeUpdatedFlag,
  updateButtonLabel,
  type UpdateButtonState,
} from "@/lib/appUpdate";
import { isStandaloneWindow } from "@/lib/install/appInstallPages";

/** "Update app": checks for the latest published version and applies it (reloads) when there is one. */
export function UpdateAppButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const [state, setState] = useState<UpdateButtonState>("idle");
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);
  const busy = state === "checking" || state === "updating";
  const Icon = busy ? LoaderCircle : state === "up-to-date" ? Check : state === "offline" ? WifiOff : RefreshCw;
  return (
    <button
      type="button"
      data-testid="update-app"
      data-state={state}
      aria-live="polite"
      disabled={busy}
      onClick={() => {
        clearTimeout(reset.current);
        void runUpdateApp(setState).then((final) => {
          if (final === "updating") return;
          reset.current = setTimeout(() => { setState("idle"); onDone?.(); }, 4000);
        });
      }}
      className={className}
    >
      <Icon className={`h-4 w-4 ${busy ? "motion-safe:animate-spin" : ""} ${state === "up-to-date" ? "text-emerald-400" : ""}`} aria-hidden="true" />
      {updateButtonLabel(state)}
    </button>
  );
}

let updatedNotice: boolean | null = null;
const AUTO_CHECK_EVERY_MS = 30 * 60 * 1000;
const FIRST_CHECK_MS = 15_000;

/**
 * Mounted once at the app root.
 * - After an update reload: "Updated to the latest version".
 * - In an installed app window (Mathemagine or Academia): checks for a newer
 *   published version shortly after opening, when the app comes back to the
 *   screen (at most every 30 minutes) and every 30 minutes, and offers it.
 *   It never reloads by itself, so a lesson is never cut off.
 */
export function AppUpdatePrompt() {
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const dismissedFor = useRef<string>("");
  useEffect(() => {
    // Shown once after the update reload (a moment later, so the toaster is listening).
    updatedNotice ??= takeUpdatedFlag();
    const updated = updatedNotice;
    const shown = updated ? setTimeout(() => toast.success("Updated to the latest version"), 600) : undefined;
    if (!isStandaloneWindow()) return () => clearTimeout(shown);
    let last = 0;
    let stop = false;
    const check = async () => {
      if (stop || Date.now() - last < AUTO_CHECK_EVERY_MS - 1000) return;
      last = Date.now();
      const result = await checkForAppUpdate();
      const version = result.published.join(",");
      if (!stop && result.status === "update-available" && dismissedFor.current !== version) {
        dismissedFor.current = "";
        setAvailable(true);
        (window as unknown as { __mathgplPublished?: string }).__mathgplPublished = version;
      }
    };
    const first = setTimeout(() => void check(), FIRST_CHECK_MS);
    const every = setInterval(() => void check(), AUTO_CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(shown);
      stop = true;
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  if (!available) return null;
  return (
    <div role="status" data-testid="update-available" className="dark fixed inset-x-3 top-3 z-[300] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-xl">
      <RefreshCw className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
      <span className="min-w-0 flex-1">A new version of the app is ready.</span>
      <button type="button" disabled={updating} onClick={() => { setUpdating(true); void applyAppUpdate(); }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 font-semibold text-slate-900">
        {updating ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : null}
        {updating ? "Updating…" : "Update now"}
      </button>
      <button type="button" aria-label="Later" title="Later" onClick={() => {
        dismissedFor.current = (window as unknown as { __mathgplPublished?: string }).__mathgplPublished ?? "";
        setAvailable(false);
      }} className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
