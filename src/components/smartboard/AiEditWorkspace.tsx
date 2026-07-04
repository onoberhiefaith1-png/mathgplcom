// AiEditWorkspace — autonomous Smartboard Operator drawer.
//
// Opens from the Presenter Preview's Edit mode. Auto-diagnoses on open,
// then waits for the teacher to press "Fix Error" — at which point it
// runs Diagnose → Reproduce → Root-cause → Repair → Verify, escalating
// through a ladder of tactics (including invasive synthetic-DOM and
// side-door writes) until the board matches the Preview.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
  Search,
  Zap,
  Copy,
  AlertTriangle,
} from "lucide-react";

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type {
  EditReport,
  EditTarget,
  OperatorEvent,
} from "@/lib/smartboard/manualEdit/types";
import {
  runManualEdit,
  runSuggestedWorkflow,
  SUGGESTED_WORKFLOWS,
} from "@/lib/smartboard/manualEdit/dispatch";
import FixOverlay, { type FixOverlayState } from "./FixOverlay";
import { renderMathInline } from "@/lib/notebook/mathRender";

interface Props {
  open: boolean;
  target: EditTarget | null;
  controller: PresentationController | null;
  onClose: () => void;
}

const phaseIcon = (phase: OperatorEvent["phase"]) => {
  switch (phase) {
    case "diagnose":
      return <Search className="h-3.5 w-3.5" />;
    case "root-cause":
      return <Zap className="h-3.5 w-3.5" />;
    case "repair":
      return <Wrench className="h-3.5 w-3.5" />;
    case "verify":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    default:
      return <Sparkles className="h-3.5 w-3.5" />;
  }
};

const AiEditWorkspace = ({ open, target, controller, onClose }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<OperatorEvent[]>([]);
  const [report, setReport] = useState<EditReport | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [overlay, setOverlay] = useState<FixOverlayState>({ kind: "idle" });
  const stopRef = useRef(false);
  const runIdRef = useRef(0);
  const startedAtRef = useRef(0);
  const tacticStepRef = useRef(0);

  // Auto-diagnose on open: just probe, do not repair — the teacher must
  // press Fix Error to authorise repairs.
  useEffect(() => {
    if (!open || !controller || !target) return;
    setPrompt("");
    setEvents([]);
    setReport(null);
    setOverlay({ kind: "idle" });
    stopRef.current = false;
    autoDiagnose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.beatId, target?.lineIdx, target?.fillerIdx, target?.kind]);

  // Live elapsed timer while fixing.
  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => {
      const ms = performance.now() - startedAtRef.current;
      setElapsedMs(ms);
      setOverlay((prev) =>
        prev.kind === "running" ? { ...prev, elapsedMs: ms } : prev,
      );
    }, 100);
    return () => window.clearInterval(id);
  }, [busy]);

  const totalTactics = 10; // matches MAX_TACTICS in operator.ts

  const pushEvent = (e: OperatorEvent) => {
    if (stopRef.current) return;
    setEvents((prev) => [...prev, e]);
    if (e.phase === "repair") {
      tacticStepRef.current += 1;
      setOverlay({
        kind: "running",
        label: `Fixing ${target?.caption ?? "issue"}`,
        tactic: e.label,
        step: tacticStepRef.current,
        of: totalTactics,
        elapsedMs: performance.now() - startedAtRef.current,
      });
    } else if (e.phase === "verify" && e.ok) {
      setOverlay({
        kind: "success",
        label: `Fixed — ${e.detail ?? "verified"}`,
      });
    }
  };

  const startRun = () => {
    stopRef.current = false;
    tacticStepRef.current = 0;
    startedAtRef.current = performance.now();
    setElapsedMs(0);
    setEvents([]);
    setReport(null);
    setBusy(true);
    setOverlay({
      kind: "running",
      label: `Diagnosing ${target?.caption ?? "issue"}…`,
      step: 0,
      of: totalTactics,
      elapsedMs: 0,
    });
  };

  const finishRun = (r: EditReport) => {
    setReport(r);
    setBusy(false);
    if (r.ok) {
      setOverlay({ kind: "success", label: r.message });
      window.setTimeout(() => setOverlay({ kind: "idle" }), 2500);
    } else {
      setOverlay({ kind: "failed", label: r.message });
      window.setTimeout(
        () => setOverlay((s) => (s.kind === "failed" ? { kind: "idle" } : s)),
        4000,
      );
    }
  };

  const autoDiagnose = async () => {
    if (!controller || !target) return;
    const myRun = ++runIdRef.current;
    setBusy(false); // read-only diagnose — no timer
    const r = await runManualEdit(target, "", controller, (e) => {
      if (runIdRef.current === myRun) setEvents((prev) => [...prev, e]);
    });
    if (runIdRef.current === myRun) setReport(r);
  };

  const fixError = async () => {
    if (!controller || !target) return;
    const myRun = ++runIdRef.current;
    startRun();
    const p = prompt.trim();
    const runFn = p
      ? () =>
          runManualEdit(target, p, controller, (e) => {
            if (runIdRef.current === myRun) pushEvent(e);
          })
      : () =>
          runManualEdit(target, "", controller, (e) => {
            if (runIdRef.current === myRun) pushEvent(e);
          });
    const r = await runFn();
    if (runIdRef.current === myRun) finishRun(r);
  };

  const runWorkflow = async (wf: (typeof SUGGESTED_WORKFLOWS)[number]) => {
    if (!controller || !target) return;
    const myRun = ++runIdRef.current;
    startRun();
    setOverlay({
      kind: "running",
      label: `Fixing: ${wf.label}`,
      step: 0,
      of: totalTactics,
      elapsedMs: 0,
    });
    const r = await runSuggestedWorkflow(target, wf, controller, (e) => {
      if (runIdRef.current === myRun) pushEvent(e);
    });
    if (runIdRef.current === myRun) finishRun(r);
  };

  const stop = () => {
    stopRef.current = true;
    runIdRef.current++;
    setBusy(false);
    setOverlay({ kind: "idle" });
  };

  const copyEscalation = async () => {
    if (!report?.escalate) return;
    const text = [
      `AI Edit escalation — ${target?.caption ?? ""}`,
      `Root cause: ${report.rootCause}`,
      `Reason: ${report.escalate.reason}`,
      "",
      "Event trail:",
      ...report.escalate.trail.map(
        (e) =>
          `- [${e.phase}] ${e.ok ? "✓" : "✗"} ${e.label}${
            e.detail ? ` — ${e.detail}` : ""
          }`,
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* noop */
    }
  };

  const statusLine = useMemo(() => {
    if (!busy) return null;
    const lastRepair = [...events].reverse().find((e) => e.phase === "repair");
    return `Testing tactic ${tacticStepRef.current}/${totalTactics}${
      lastRepair ? ` — ${lastRepair.label}` : ""
    } · ${(elapsedMs / 1000).toFixed(1)}s`;
  }, [busy, events, elapsedMs]);

  if (!open || !target) return null;

  const primaryLabel = busy
    ? `Fixing… ${(elapsedMs / 1000).toFixed(1)}s`
    : report?.ok
      ? "Fixed ✓"
      : report && !report.ok
        ? "Fix Again"
        : "Fix Error";

  const primaryStyle: React.CSSProperties = busy
    ? { background: "#b45309" }
    : report?.ok
      ? { background: "#15803d" }
      : { background: "#b91c1c" };

  return (
    <>
      <FixOverlay state={overlay} />
      <aside
        role="dialog"
        aria-label="AI Edit workspace"
        className="fixed right-0 top-0 h-full w-[440px] z-[80] flex flex-col shadow-2xl border-l"
        style={{
          background: "rgba(246,244,239,0.98)",
          borderColor: "rgba(138,106,31,0.25)",
          backdropFilter: "blur(10px)",
          color: "#1a2230",
        }}
      >
        <header
          className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
          style={{ borderColor: "rgba(138,106,31,0.2)" }}
        >
          <Sparkles className="h-4 w-4" style={{ color: "#8a6a1f" }} />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-[0.35em]" style={{ color: "#8a6a1f" }}>
              AI Operator · Autonomous
            </p>
            <p className="text-sm font-semibold truncate">{target.caption}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close AI Edit workspace"
            className="grid place-items-center rounded-full h-8 w-8 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {statusLine && (
          <div
            className="px-4 py-2 text-[12px] border-b flex items-center gap-2"
            style={{
              borderColor: "rgba(138,106,31,0.2)",
              background: "rgba(180,83,9,0.06)",
              color: "#7c2d12",
            }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="truncate">{statusLine}</span>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          <section
            className="rounded-md border p-3"
            style={{ borderColor: "rgba(138,106,31,0.2)", background: "rgba(255,255,255,0.6)" }}
          >
            <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Selection</p>
            <p className="text-[11px] opacity-70 mb-2">
              {target.kind}
              {typeof target.lineIdx === "number" && ` · Line ${target.lineIdx + 1}`}
              {typeof target.fillerIdx === "number" && ` · Chip ${target.fillerIdx + 1}`}
            </p>
            {target.text && (
              <div className="text-[15px] leading-relaxed font-serif">
                {renderMathInline(target.text)}
              </div>
            )}
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-widest opacity-60 mb-2">Quick workflows</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_WORKFLOWS.map((wf) => (
                <button
                  key={wf.label}
                  disabled={busy || !controller}
                  onClick={() => runWorkflow(wf)}
                  title={wf.hint}
                  className="text-[11px] rounded-full border px-2.5 py-1 hover:bg-black/5 disabled:opacity-40"
                  style={{ borderColor: "rgba(138,106,31,0.35)" }}
                >
                  {wf.label}
                </button>
              ))}
            </div>
          </section>

          {(busy || events.length > 0) && (
            <section>
              <p className="text-[10px] uppercase tracking-widest opacity-60 mb-2 flex items-center gap-2">
                Operator timeline
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              </p>
              <ol className="space-y-1">
                {events.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12px] rounded px-2 py-1"
                    style={{
                      background: e.ok ? "rgba(21,128,61,0.06)" : "rgba(180,83,9,0.08)",
                    }}
                  >
                    <span className="mt-0.5" style={{ color: e.ok ? "#15803d" : "#b45309" }}>
                      {phaseIcon(e.phase)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="font-medium">{e.label}</span>
                      {e.detail && <span className="opacity-60"> — {e.detail}</span>}
                    </span>
                    <span className="text-[10px] opacity-40 shrink-0">
                      {e.tookMs != null ? `${e.tookMs}ms` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {report && !busy && (
            <section
              className="rounded-md border p-3"
              style={{
                borderColor: report.ok ? "rgba(21,128,61,0.4)" : "rgba(180,83,9,0.4)",
                background: report.ok ? "rgba(21,128,61,0.08)" : "rgba(180,83,9,0.08)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                {report.ok ? (
                  <CheckCircle2 className="h-4 w-4" style={{ color: "#15803d" }} />
                ) : (
                  <XCircle className="h-4 w-4" style={{ color: "#b45309" }} />
                )}
                <p className="text-sm font-semibold">{report.message}</p>
              </div>
              <p className="text-[10px] uppercase tracking-widest opacity-60">
                Intent · {report.intent}
                {report.rootCause && ` · Cause · ${report.rootCause}`}
              </p>
              {report.escalate && (
                <div
                  className="mt-2 rounded border p-2"
                  style={{ borderColor: "rgba(180,83,9,0.35)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#b45309" }} />
                    <p className="text-[11px] font-semibold">Escalate to code fix</p>
                  </div>
                  <p className="text-[11px] opacity-80 mb-2">{report.escalate.reason}</p>
                  <button
                    onClick={copyEscalation}
                    className="inline-flex items-center gap-1.5 text-[11px] rounded-md border px-2 py-1 hover:bg-black/5"
                    style={{ borderColor: "rgba(138,106,31,0.35)" }}
                  >
                    <Copy className="h-3 w-3" /> Copy diagnostic trail
                  </button>
                </div>
              )}
            </section>
          )}

          <section>
            <p className="text-[10px] uppercase tracking-widest opacity-60 mb-2">
              Describe the issue (optional)
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Note on line 1 is not clickable."
              className="w-full rounded-md border px-3 py-2 text-sm bg-white"
              style={{ borderColor: "rgba(138,106,31,0.3)" }}
            />
          </section>
        </div>

        <footer
          className="flex items-center justify-end gap-2 px-4 py-3 border-t shrink-0"
          style={{ borderColor: "rgba(138,106,31,0.2)" }}
        >
          <button
            onClick={onClose}
            className="text-sm rounded-md border px-3 py-1.5 hover:bg-black/5"
            style={{ borderColor: "rgba(138,106,31,0.35)" }}
          >
            Close
          </button>
          {busy && (
            <button
              onClick={stop}
              className="text-sm rounded-md border px-3 py-1.5 hover:bg-black/5"
              style={{ borderColor: "rgba(138,106,31,0.35)" }}
            >
              Stop
            </button>
          )}
          <button
            onClick={fixError}
            disabled={!controller || busy}
            className="text-sm rounded-md px-3 py-1.5 text-white disabled:opacity-60"
            style={primaryStyle}
          >
            {primaryLabel}
          </button>
        </footer>
      </aside>
    </>
  );
};

export default AiEditWorkspace;
