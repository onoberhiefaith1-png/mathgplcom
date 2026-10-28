import { useEffect, useRef } from "react";
import { useMathBoard } from "@/hooks/useMathBoard";
import { MathRender } from "./MathRender";
import { RewardStrip } from "./RewardStrip";
import { Pencil, MoreVertical } from "lucide-react";

export const SessionStack = () => {
  const { state, focusContainer, focusSession } = useMathBoard();
  const isSmart = state.mode === "smartboard";
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.sessions.length]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-3">
      {state.sessions.filter((s) => !(isSmart && s.index === 1)).map((s) => {
        const isCurrent = state.cursor.container.sessionId === s.id;
        const borderClass =
          s.status === "valid" ? "border-emerald-400/60 shadow-[0_0_28px_hsl(150_80%_50%/0.25)]" :
          s.status === "invalid" ? "border-rose-500/60 shadow-[0_0_24px_hsl(0_80%_55%/0.25)] animate-pulse" :
          s.status === "pending" ? "border-amber-300/50" :
          isCurrent ? "border-cyan-400/60 shadow-[0_0_24px_hsl(200_90%_60%/0.25)]" :
          "border-amber-200/15";
        const labelText = s.index === 1 && s.nodes.length === 0 ? "ENTER YOUR QUESTION" : null;
        return (
          <div
            key={s.id}
            data-session-id={s.id}
            onClick={() => focusSession(s.id)}
            className={[
              "group relative flex items-center gap-3 rounded-2xl border bg-card/50 backdrop-blur",
              "px-4 py-3 transition-all cursor-text",
              borderClass,
            ].join(" ")}
          >
            {/* Equation area (~80%) */}
            <div className="flex-1 min-w-0">
              {labelText && (
                <div className="text-[10px] uppercase tracking-widest text-cyan-300/70 mb-0.5">
                  {labelText}
                </div>
              )}
              <div className="overflow-x-auto whitespace-nowrap text-foreground">
                <MathRender
                  sessionId={s.id}
                  nodes={s.nodes}
                  cursor={state.cursor}
                  onFocus={focusContainer}
                />
              </div>
            </div>

            {/* Reward strip embedded on the right */}
            {!isSmart && <RewardStrip rewards={s.rewards} glowing={s.status === "valid"} />}

            {/* Edit / menu */}
            <button className="rounded-lg border border-amber-200/20 p-2 text-amber-200/70 opacity-0 group-hover:opacity-100 transition" aria-label="edit">
              {s.index === 1 ? <Pencil className="h-4 w-4" /> : <MoreVertical className="h-4 w-4" />}
            </button>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

export default SessionStack;
