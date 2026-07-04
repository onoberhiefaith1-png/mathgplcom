// AiEditWorkspace — right-side drawer opened from the Presenter Preview's
// Edit mode. Loads the selected content, lets the teacher describe the
// issue, and runs the local dispatcher against the shared
// PresentationController to synchronize the Smartboard with the Preview.

import { useEffect, useState } from "react";
import { X, Sparkles, CheckCircle2, XCircle } from "lucide-react";

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, EditReport } from "@/lib/smartboard/manualEdit/types";
import { runManualEdit, SUGGESTED_PROMPTS } from "@/lib/smartboard/manualEdit/dispatch";
import { renderMathInline } from "@/lib/notebook/mathRender";

interface Props {
  open: boolean;
  target: EditTarget | null;
  controller: PresentationController | null;
  onClose: () => void;
}

const AiEditWorkspace = ({ open, target, controller, onClose }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<EditReport | null>(null);

  useEffect(() => {
    if (open) {
      setPrompt("");
      setReport(null);
    }
  }, [open, target?.beatId, target?.lineIdx, target?.fillerIdx, target?.kind]);

  if (!open || !target) return null;

  const apply = async () => {
    if (!controller) return;
    setBusy(true);
    const r = await runManualEdit(target, prompt, controller);
    setReport(r);
    setBusy(false);
  };

  return (
    <aside
      role="dialog"
      aria-label="AI Edit workspace"
      className="fixed right-0 top-0 h-full w-[420px] z-[80] flex flex-col shadow-2xl border-l"
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
            AI Edit · Manual
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
        <section className="rounded-md border p-3" style={{ borderColor: "rgba(138,106,31,0.2)", background: "rgba(255,255,255,0.6)" }}>
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
          <p className="text-[10px] uppercase tracking-widest opacity-60 mb-2">Quick suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((s) => (
              <button
                key={s.label}
                onClick={() => setPrompt(s.prompt)}
                className="text-[11px] rounded-full border px-2.5 py-1 hover:bg-black/5"
                style={{ borderColor: "rgba(138,106,31,0.35)" }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="text-[10px] uppercase tracking-widest opacity-60 mb-2">Describe the issue</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="e.g. This note did not appear on the Smartboard."
            className="w-full rounded-md border px-3 py-2 text-sm bg-white"
            style={{ borderColor: "rgba(138,106,31,0.3)" }}
          />
        </section>

        {report && (
          <section
            className="rounded-md border p-3"
            style={{
              borderColor: report.ok ? "rgba(21,128,61,0.4)" : "rgba(180,83,9,0.4)",
              background: report.ok ? "rgba(21,128,61,0.08)" : "rgba(180,83,9,0.08)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {report.ok ? (
                <CheckCircle2 className="h-4 w-4" style={{ color: "#15803d" }} />
              ) : (
                <XCircle className="h-4 w-4" style={{ color: "#b45309" }} />
              )}
              <p className="text-sm font-semibold">{report.message}</p>
            </div>
            <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Intent · {report.intent}</p>
            <ul className="space-y-1">
              {report.actions.map((a, i) => (
                <li key={i} className="text-[12px] flex items-start gap-2">
                  <span className={a.ok ? "text-green-700" : "text-amber-700"}>{a.ok ? "✓" : "•"}</span>
                  <span>
                    {a.label}
                    {a.detail && <span className="opacity-60"> — {a.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
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
        {report && !report.ok && (
          <button
            onClick={apply}
            disabled={busy || !controller}
            className="text-sm rounded-md px-3 py-1.5 text-white disabled:opacity-50"
            style={{ background: "#8a6a1f" }}
          >
            Retry
          </button>
        )}
        {!report && (
          <button
            onClick={apply}
            disabled={busy || !controller}
            className="text-sm rounded-md px-3 py-1.5 text-white disabled:opacity-50"
            style={{ background: "#8a6a1f" }}
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        )}
      </footer>
    </aside>
  );
};

export default AiEditWorkspace;
