// DiagnosisPanel — right-side overlay showing the Presentation AI's live
// state, active issue actions, issue log, and end-of-run report.
// Portaled into the Smartboard root so it overlays the board without
// resizing it (unlike the Presenter Preview which is a flex sibling).

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Copy, X, Wrench, SkipForward, FileCode2, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSmartboardRoot } from "@/components/smartboard/SmartboardRoot";
import type { UsePresentationAIResult } from "@/hooks/usePresentationAI";
import { buildLovablePrompt } from "@/lib/smartboard/presentationAI/lovablePrompt";
import type { Issue } from "@/lib/smartboard/presentationAI/types";

export interface DiagnosisPanelProps {
  ai: UsePresentationAIResult;
  open: boolean;
  onClose: () => void;
  notebookId?: string | null;
  notebookTitle?: string | null;
}

const IssueCard = ({
  issue,
  onRectify,
  onProceed,
  onGeneratePrompt,
  repairing,
}: {
  issue: Issue;
  onRectify: () => void;
  onProceed: () => void;
  onGeneratePrompt: () => void;
  repairing: boolean;
}) => (
  <div
    className="rounded-lg border p-3 space-y-2"
    style={{ borderColor: "rgba(220,38,38,0.35)", background: "rgba(254,242,242,0.85)" }}
  >
    <div className="flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-none text-red-600" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-red-700">Presentation Error</p>
        <p className="text-sm font-semibold text-red-900">{issue.summary}</p>
      </div>
    </div>
    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs text-neutral-700 pl-6">
      <dt className="font-semibold">Section</dt><dd>{issue.section}</dd>
      {issue.lineIdx !== null && (<><dt className="font-semibold">Line</dt><dd>{issue.lineIdx + 1}</dd></>)}
      <dt className="font-semibold">Expected</dt><dd className="break-words">{issue.expected}</dd>
      <dt className="font-semibold">Actual</dt><dd className="break-words">{issue.actual}</dd>
      <dt className="font-semibold">Cause</dt><dd className="break-words">{issue.probableCause}</dd>
    </dl>
    <div className="flex flex-wrap gap-2 pt-1">
      {issue.repairable && (
        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={repairing} onClick={onRectify}>
          <Wrench className="h-3.5 w-3.5" /> {repairing ? "Repairing…" : "Rectify"}
        </Button>
      )}
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onProceed}>
        <SkipForward className="h-3.5 w-3.5" /> Proceed
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onGeneratePrompt}>
        <FileCode2 className="h-3.5 w-3.5" /> Generate Lovable Prompt
      </Button>
    </div>
  </div>
);

const PromptModal = ({
  prompt,
  onClose,
}: {
  prompt: string;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lovable Prompt</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </div>
        <pre className="max-h-[60vh] overflow-auto rounded bg-neutral-50 p-3 text-xs whitespace-pre-wrap font-mono border">
          {prompt}
        </pre>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prompt);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              } catch {
                // noop
              }
            }}
          >
            <Copy className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy prompt"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const DiagnosisPanel = ({
  ai,
  open,
  onClose,
  notebookId,
  notebookTitle,
}: DiagnosisPanelProps) => {
  const root = useSmartboardRoot();
  const [promptText, setPromptText] = useState<string | null>(null);

  const healthy = ai.state === "presenting" || ai.state === "idle";
  const progress = ai.totalSteps > 0
    ? Math.round(((ai.stepIndex + 1) / ai.totalSteps) * 100)
    : 0;

  const currentSummary = useMemo(() => {
    const s = ai.currentStep;
    if (!s) return "—";
    if (s.kind === "beat") return `${s.beat.caption ?? s.beat.id}`;
    return `${s.beat.caption ?? s.beat.id} · Line ${s.lineIdx + 1}`;
  }, [ai.currentStep]);

  if (!open || !root) return null;

  const generateForActive = () => {
    if (!ai.activeIssue) return;
    setPromptText(
      buildLovablePrompt(ai.activeIssue, { notebookId, notebookTitle, speed: ai.speed }),
    );
  };

  const panel = (
    <aside
      className="absolute right-0 top-0 z-[150] flex h-full w-[30%] min-w-[320px] max-w-[440px] flex-col border-l bg-white/95 shadow-2xl backdrop-blur"
      style={{ borderColor: "rgba(0,0,0,0.12)" }}
    >
      <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            healthy ? "bg-emerald-500" : "bg-red-600 animate-pulse"
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Presentation AI</p>
          <p className="text-sm font-semibold text-neutral-900">
            {healthy ? "Presentation Healthy" : ai.state === "repairing" ? "Repairing…" : "Error Detected"}
          </p>
        </div>
        <button onClick={onClose} className="rounded p-1 hover:bg-neutral-100" aria-label="Close diagnosis panel">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b px-4 py-2 text-xs text-neutral-700" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="flex items-center justify-between">
          <span className="font-semibold">Now presenting</span>
          <span className="tabular-nums text-neutral-500">
            {ai.stepIndex + 1}/{ai.totalSteps}
          </span>
        </div>
        <div className="truncate text-neutral-900">{currentSummary}</div>
        <div className="mt-2 h-1 w-full rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-3">
        {ai.activeIssue && (
          <IssueCard
            issue={ai.activeIssue}
            repairing={ai.state === "repairing"}
            onRectify={() => ai.rectify()}
            onProceed={() => ai.proceed()}
            onGeneratePrompt={generateForActive}
          />
        )}

        {ai.state === "reporting" && ai.report && (
          <div
            className="rounded-lg border p-3 space-y-2"
            style={{
              borderColor: ai.report.status === "PASS" ? "rgba(22,163,74,0.4)" : "rgba(220,38,38,0.4)",
              background: ai.report.status === "PASS" ? "rgba(240,253,244,0.85)" : "rgba(254,242,242,0.85)",
            }}
          >
            <div className="flex items-center gap-2">
              {ai.report.status === "PASS" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              <p className="text-lg font-bold">
                Presentation {ai.report.status}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt>Sections tested</dt><dd className="tabular-nums">{ai.report.stats.beats}</dd>
              <dt>Lines tested</dt><dd className="tabular-nums">{ai.report.stats.lines}</dd>
              <dt>Floating Numbers</dt><dd className="tabular-nums">{ai.report.stats.floating}</dd>
              <dt>Teacher Notes</dt><dd className="tabular-nums">{ai.report.stats.notes}</dd>
              <dt>Repairs performed</dt><dd className="tabular-nums">{ai.report.stats.repairs}</dd>
              <dt>Unresolved issues</dt><dd className="tabular-nums">{ai.report.unresolved.length}</dd>
            </dl>
            {ai.report.unresolved.length > 0 && (
              <div className="pt-2 space-y-2">
                {ai.report.unresolved.map((i) => (
                  <div key={i.id} className="rounded border border-neutral-200 bg-white p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-800">{i.summary}</p>
                        <p className="text-neutral-500">
                          {i.section}{i.lineIdx !== null ? ` · Line ${i.lineIdx + 1}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() =>
                          setPromptText(buildLovablePrompt(i, { notebookId, notebookTitle, speed: ai.speed }))
                        }
                      >
                        <FileCode2 className="h-3.5 w-3.5" /> Prompt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {ai.issues.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1">Issue log</p>
            <ul className="space-y-1 text-xs">
              {ai.issues.map((i) => (
                <li key={i.id} className="rounded border border-neutral-200 bg-white p-2">
                  <p className="font-semibold text-neutral-800">{i.summary}</p>
                  <p className="text-neutral-500">
                    {i.section}{i.lineIdx !== null ? ` · Line ${i.lineIdx + 1}` : ""} · {i.kind}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ai.state === "idle" && ai.issues.length === 0 && !ai.report && (
          <p className="text-xs text-neutral-500 flex items-center gap-2">
            <PlayCircle className="h-4 w-4" /> Click Autoplay to start the simulated presentation.
          </p>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {createPortal(panel, root)}
      {promptText && <PromptModal prompt={promptText} onClose={() => setPromptText(null)} />}
    </>
  );
};

export default DiagnosisPanel;
