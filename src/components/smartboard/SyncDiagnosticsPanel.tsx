// Developer-only diagnostics for the live CLASSROOM SmartBoard.
//
// Hidden by default. Turn it on for one board with `?sbdebug=1` in the URL, or
// persistently in a dev console with `localStorage.sbdebug = "1"`. Teachers and
// students never see it.

import { useEffect, useState } from "react";
import type { SyncDiagnostics } from "@/hooks/useSmartboardSync";

export const syncDebugEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("sbdebug") === "1") return true;
    return window.localStorage.getItem("sbdebug") === "1";
  } catch {
    return false;
  }
};

const ago = (t: number | null) => (t == null ? "—" : `${Math.max(0, Math.round((Date.now() - t) / 100) / 10)}s ago`);

export const SyncDiagnosticsPanel = ({ diagnostics }: { diagnostics: SyncDiagnostics }) => {
  const [show, setShow] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { setShow(syncDebugEnabled()); }, []);
  useEffect(() => {
    if (!show) return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [show]);
  if (!show) return null;

  const rows: [string, string][] = [
    ["connection", diagnostics.connected ? "live" : "reconnecting"],
    ["class", diagnostics.classId ?? "—"],
    ["client", diagnostics.selfId?.slice(0, 8) ?? "—"],
    ["epoch/seq", `${diagnostics.epoch} / ${diagnostics.seqSent}`],
    ["queued", String(diagnostics.queued)],
    ["last sent", ago(diagnostics.lastSentAt)],
    ["last received", `${ago(diagnostics.lastReceivedAt)} #${diagnostics.lastReceivedSeq ?? "—"}`],
    ["from", diagnostics.lastReceivedFrom?.slice(0, 8) ?? "—"],
    ["fields", diagnostics.lastReceivedKeys.join(",") || "—"],
    ["peers", String(diagnostics.peers)],
    ["hydrated", diagnostics.hydratedFrom ?? "—"],
    ["errors", diagnostics.errors.slice(-2).join(" | ") || "none"],
  ];

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-[90] max-w-[22rem] rounded-md border border-border bg-background/85 p-2 font-mono text-[10px] leading-4 text-muted-foreground shadow">
      <div className="mb-1 font-semibold text-foreground">classroom sync</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="w-24 shrink-0 opacity-70">{k}</span>
          <span className="break-all text-foreground/90">{v}</span>
        </div>
      ))}
    </div>
  );
};

export default SyncDiagnosticsPanel;
