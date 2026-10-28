/**
 * Freeze detector.
 *
 * Two independent signals:
 *  1. Long tasks (>200ms) — the interface was actually blocked.
 *  2. A watchdog tick that should fire every second; if it arrives very late
 *     the main thread was frozen for that gap.
 *
 * When a freeze is seen we also record which element currently sits under the
 * centre of the screen, because a stray full-screen overlay produces the exact
 * same symptom (page painted, every click swallowed).
 */
import { oldestResources, resourceCounts } from "./registry";
import {
  describeInteractionState,
  pointerInteractionActive,
  resetInteractionState,
} from "./interactionReset";
import { healLeakedOverlays } from "./overlayGuard";

export type FreezeReport = {
  at: number;
  blockedMs: number;
  source: "longtask" | "tick";
  topElement?: string;
  counts: Record<string, number>;
  /** Cursor / pointer-capture snapshot taken at the moment of the freeze. */
  interaction?: ReturnType<typeof describeInteractionState>;
  /** True when stale interaction state was found and cleared silently. */
  healed?: boolean;
};

const reports: FreezeReport[] = [];
const MAX_REPORTS = 40;

function describeTopElement(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  if (!el) return undefined;
  const cls = typeof el.className === "string" ? el.className.slice(0, 120) : "";
  return `${el.tagName.toLowerCase()}${cls ? `.${cls.split(/\s+/).slice(0, 4).join(".")}` : ""}`;
}

function record(source: FreezeReport["source"], blockedMs: number) {
  const report: FreezeReport = {
    at: Date.now(),
    blockedMs: Math.round(blockedMs),
    source,
    topElement: describeTopElement(),
    counts: resourceCounts(),
    interaction: describeInteractionState(),
  };

  // Self-heal, never reload: if a cursor override or a pointer capture is still
  // held while the interface is blocked, that is exactly the state a refresh
  // used to clear — clear it here instead and keep the page as it is.
  const stale =
    !!report.interaction &&
    (!!report.interaction.bodyCursor ||
      report.interaction.cursorOverrides > 0 ||
      report.interaction.pointerCaptures > 0);
  if (stale && blockedMs > 400 && !pointerInteractionActive()) {
    resetInteractionState("freeze-monitor");
    report.healed = true;
  }
  // The dominant real cause of click-death: a dismissed dialog / sheet whose
  // portal or body pointer-events lock survived its unmount.
  if (blockedMs > 400 && healLeakedOverlays("freeze-monitor") > 0) report.healed = true;
  reports.push(report);
  if (reports.length > MAX_REPORTS) reports.shift();
  if (blockedMs > 1_500) {
    console.warn("[stability] interface blocked", report, "oldest resources:", oldestResources(5));
  }
}

export function freezeReports(): FreezeReport[] {
  return [...reports];
}

/** Install the detectors. Returns a cleanup function. */
export function startFreezeMonitor(): () => void {
  if (typeof window === "undefined") return () => {};

  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= 200) record("longtask", entry.duration);
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    observer = undefined; // Safari / unsupported — the tick check still works.
  }

  let last = Date.now();
  const tick = window.setInterval(() => {
    const now = Date.now();
    const drift = now - last - 1_000;
    last = now;
    if (drift > 1_000 && !document.hidden) record("tick", drift);
  }, 1_000);

  return () => {
    window.clearInterval(tick);
    observer?.disconnect();
  };
}
