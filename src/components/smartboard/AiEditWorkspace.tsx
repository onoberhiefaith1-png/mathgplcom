// AiEditWorkspace — autonomous Smartboard Operator drawer.
//
// Opens from the Presenter Preview's Edit mode. On open it immediately
// runs a Diagnose → Reproduce → Root-cause → Repair → Verify loop against
// the shared PresentationController. The teacher watches a live phase
// timeline and can Stop, Retry, or Escalate.

import { useEffect, useRef, useState } from "react";
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
  const stopRef = useRef(false);
  const runIdRef = useRef(0);

  // Auto-diagnose on open.
  useEffect(() => {
    if (!open || !controller || !target) return;
    setPrompt("");
    setEvents([]);
    setReport(null);
    stopRef.current = false;
    runDiagnoseOnly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.beatId, target?.lineIdx, target?.fillerIdx, target?.kind]);

  const pushEvent = (e: OperatorEvent) => {
    if (stopRef.current) return;
    setEvents((prev) => [...prev, e]);
  };

  const runDiagnoseOnly = async () => {
    if (!controller || !target) return;
    const myRun = ++runIdRef.current;
    setBusy(true);
    // Use the operator with a "verify only" pass — simplest: run with no
    // forced cause; if board matches Preview it returns ok immediately.
    const r = await runManualEdit(target, "", controller, (e) => {
      if (runIdRef.current === myRun) pushEvent(e);
    });
    if (runIdRef.current === myRun) {
      setReport(r);
      setBusy(false);
    }
  };

  const runFreeform = async () => {
    if (!controller || !target) return;
    const myRun = ++runIdRef.current;
    stopRef.current = false;
    setBusy(true);
    setEvents([]);
    setReport(null);
    const r = await runManualEdit(target, prompt, controller, (e) => {
      if (runIdRef.current === myRun) pushEvent(e);
    });
    if (runIdRef.current === myRun) {
      setReport(r);
      setBusy(false);
    }
  };

  const runWorkflow = async (wf: (typeof SUGGESTED_WORKFLOWS)[number]) => {
    if (!controller || !target) return;
    const myRun = ++runIdRef.current;
    stopRef.current = false;
    setBusy(true);
    setEvents([]);
    setReport(null);
    const r = await runSuggestedWorkflow(target, wf, controller, (e) => {
      if (runIdRef.current === myRun) pushEvent(e);
    });
    if (runIdRef.current === myRun) {
      setReport(r);
      setBusy(false);
    }
  };

  const stop = () => {
    stopRef.current = true;
    runIdRef.current++;
    setBusy(false);
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

  if (!open || !target) return null;

  return (
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

        {report && (
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
              <div className="mt-2 rounded border p-2" style={{ borderColor: "rgba(180,83,9,0.35)" }}>
                <p className="text-[11px] font-semibold mb-1">Escalate to code fix</p>
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
          <p className="text-[10px] uppercase tracking-widest opacity-60 mb-2">Describe the issue (optional)</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. This note did not appear on the Smartboard."
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
          Cancel
        </button>
        {busy ? (
          <button
            onClick={stop}
            className="text-sm rounded-md px-3 py-1.5 text-white"
            style={{ background: "#b45309" }}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={runFreeform}
            disabled={!controller}
            className="text-sm rounded-md px-3 py-1.5 text-white disabled:opacity-50"
            style={{ background: "#8a6a1f" }}
          >
            {report ? "Retry" : "Run"}
          </button>
        )}
      </footer>
    </aside>
  );
};

export default AiEditWorkspace;
