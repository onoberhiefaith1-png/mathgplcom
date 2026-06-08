import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CornerDownLeft, Eye } from "lucide-react";
import { useMathBoard } from "@/hooks/useMathBoard";
import { pickAssistant, AssistantHint } from "@/lib/mathboard/assistantPicker";

export const VisualAssistant = () => {
  const { state, submit } = useMathBoard();
  const [collapsed, setCollapsed] = useState(false);

  const hint: AssistantHint = useMemo(() => {
    const cur = state.sessions[state.sessions.length - 1];
    const question = state.sessions[0];
    return pickAssistant(cur?.nodes ?? [], question?.nodes ?? []);
  }, [state.sessions]);

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/20 bg-card/40 backdrop-blur text-amber-200/70 hover:text-amber-200 transition"
          title="Expand assistant"
          aria-label="Expand assistant"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={submit}
          className="flex flex-1 w-10 flex-col items-center justify-center rounded-xl border-2 border-cyan-400/60 bg-cyan-500/15 text-cyan-100 shadow-[0_0_18px_hsl(200_90%_60%/0.3)] hover:bg-cyan-500/25 transition"
          title="Enter"
          aria-label="Enter"
        >
          <CornerDownLeft className="h-5 w-5" />
          <span className="text-[9px] font-bold tracking-widest mt-1 [writing-mode:vertical-rl] rotate-180">ENTER</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-2">
      <div className="rounded-2xl border border-amber-200/15 bg-card/40 backdrop-blur p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-foreground">
            <Eye className="h-4 w-4 text-cyan-300" />
            <span className="text-xs font-bold uppercase tracking-wider">Assistant</span>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-md p-1 text-amber-200/70 hover:text-amber-200 transition"
            title="Collapse"
            aria-label="Collapse"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3 text-sm text-cyan-100/90">
          <div className="font-semibold text-cyan-200 mb-1.5 text-sm">{hint.title}</div>
          <div className="text-cyan-100/80 leading-relaxed whitespace-pre-line text-xs">{hint.body}</div>
        </div>
      </div>
      <button
        onClick={submit}
        className="flex items-center justify-center gap-3 rounded-2xl border-2 border-cyan-400/60 bg-cyan-500/15 px-6 py-3 text-cyan-100 shadow-[0_0_24px_hsl(200_90%_60%/0.35)] hover:bg-cyan-500/25 transition"
      >
        <span className="text-base font-bold tracking-widest">ENTER</span>
        <CornerDownLeft className="h-5 w-5" />
      </button>
    </aside>
  );
};

export default VisualAssistant;
