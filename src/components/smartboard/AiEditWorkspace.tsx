// AiEditWorkspace — Live Mirror Mode status strip.
//
// Live Mirror Mode replaces the old autonomous operator drawer. The
// Presenter Preview is the source of truth; clicking any preview item
// mirrors that exact item onto the Smartboard via `runMirror`.
//
// This component is now just a small header strip:
//   • shows current selection + caption
//   • shows ✓ mirrored / ✗ mapping broken status returned by verify
//   • an Exit button that clears the Smartboard and closes mirror mode
//
// No timelines, no tactics, no repair — if a mapping produces nothing,
// that IS the diagnostic and the teacher knows which function to fix.

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, MirrorResult } from "@/lib/smartboard/manualEdit/types";
import { clearBoard, runMirror } from "@/lib/smartboard/manualEdit/dispatch";
import { renderMathInline } from "@/lib/notebook/mathRender";

interface Props {
  open: boolean;
  target: EditTarget | null;
  controller: PresentationController | null;
  onClose: () => void;
}

const AiEditWorkspace = ({ open, target, controller, onClose }: Props) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MirrorResult | null>(null);
  const runIdRef = useRef(0);
  const lastKeyRef = useRef<string | null>(null);

  // On open (and every fresh selection) mirror the target onto the board.
  useEffect(() => {
    if (!open || !controller) return;

    // Entering mirror mode with no selection yet — just clear the board.
    if (!target) {
      clearBoard(controller);
      setResult(null);
      return;
    }

    const key = [
      target.kind,
      target.beatId,
      target.lineIdx ?? "",
      target.fillerIdx ?? "",
    ].join("|");
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const myRun = ++runIdRef.current;
    setBusy(true);
    setResult(null);
    (async () => {
      const r = await runMirror(target, controller);
      if (runIdRef.current === myRun) {
        setResult(r);
        setBusy(false);
      }
    })();
  }, [open, controller, target]);

  // On close, clear the board and reset selection state so re-entering
  // starts blank.
  useEffect(() => {
    if (!open && controller) {
      clearBoard(controller);
      lastKeyRef.current = null;
      setResult(null);
    }
  }, [open, controller]);

  if (!open) return null;

  const badge = busy ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "#7c2d12" }}>
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mirroring…
    </span>
  ) : result?.ok ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "#15803d" }}>
      <CheckCircle2 className="h-3.5 w-3.5" /> {result.message}
    </span>
  ) : result ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "#b45309" }}>
      <XCircle className="h-3.5 w-3.5" /> {result.message}
    </span>
  ) : (
    <span className="text-[11px] opacity-70">
      Click any item in the Presenter Preview to mirror it on the Smartboard.
    </span>
  );

  return (
    <aside
      role="dialog"
      aria-label="Live Mirror Mode"
      className="fixed left-1/2 -translate-x-1/2 top-3 z-[80] max-w-[720px] w-[min(720px,92vw)] rounded-full shadow-xl border flex items-center gap-3 px-4 py-2"
      style={{
        background: "rgba(246,244,239,0.98)",
        borderColor: "rgba(138,106,31,0.3)",
        backdropFilter: "blur(10px)",
        color: "#1a2230",
      }}
    >
      <Sparkles className="h-4 w-4 shrink-0" style={{ color: "#8a6a1f" }} />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-[0.35em]" style={{ color: "#8a6a1f" }}>
          Live Mirror · Preview → Smartboard
        </p>
        <div className="flex items-center gap-3 min-w-0">
          {target ? (
            <p className="text-sm font-semibold truncate">
              {target.caption}
              {target.text && (
                <span className="ml-2 opacity-60 font-normal font-serif">
                  {renderMathInline(target.text.slice(0, 80))}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm font-semibold opacity-60">No selection</p>
          )}
        </div>
        <div className="mt-0.5">{badge}</div>
        {result && !result.ok && result.detail && (
          <p className="text-[10px] opacity-70 truncate">{result.detail}</p>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Exit Live Mirror Mode"
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] hover:bg-black/5 shrink-0"
        style={{ borderColor: "rgba(138,106,31,0.35)" }}
      >
        <X className="h-3.5 w-3.5" /> Exit
      </button>
    </aside>
  );
};

export default AiEditWorkspace;
