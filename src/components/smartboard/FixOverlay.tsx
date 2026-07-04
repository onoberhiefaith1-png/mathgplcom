// FixOverlay — a large, high-contrast toast that displays the operator's
// current tactic name on top of the Smartboard column. Gives the teacher
// the "I can see it working" feedback loop.

import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export type FixOverlayState =
  | { kind: "idle" }
  | { kind: "running"; label: string; tactic?: string; step?: number; of?: number; elapsedMs: number }
  | { kind: "success"; label: string }
  | { kind: "failed"; label: string };

interface Props {
  state: FixOverlayState;
}

const FixOverlay = ({ state }: Props) => {
  if (state.kind === "idle") return null;

  const bg =
    state.kind === "success"
      ? "rgba(21,128,61,0.95)"
      : state.kind === "failed"
        ? "rgba(180,83,9,0.95)"
        : "rgba(30,41,59,0.92)";

  const icon =
    state.kind === "success" ? (
      <CheckCircle2 className="h-6 w-6" />
    ) : state.kind === "failed" ? (
      <XCircle className="h-6 w-6" />
    ) : (
      <Loader2 className="h-6 w-6 animate-spin" />
    );

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-6 z-[90] -translate-x-1/2 rounded-xl px-5 py-3 shadow-2xl backdrop-blur"
      style={{
        background: bg,
        color: "white",
        maxWidth: "min(720px, 90vw)",
        pointerEvents: "none",
      }}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.35em] opacity-80">
            AI Operator
            {state.kind === "running" && state.step != null && state.of != null && (
              <> · step {state.step}/{state.of}</>
            )}
            {state.kind === "running" && (
              <> · {(state.elapsedMs / 1000).toFixed(1)}s</>
            )}
          </p>
          <p className="text-base font-semibold truncate">
            {state.label}
            {state.kind === "running" && state.tactic && (
              <span className="opacity-75"> — {state.tactic}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FixOverlay;
