import { useEffect, useState } from "react";
import { MathBoardProvider, useMathBoard } from "@/hooks/useMathBoard";
import { Container } from "@/lib/mathboard/cursor";

import TopHud from "@/components/mathboard/TopHud";
import SessionStack from "@/components/mathboard/SessionStack";
import BottomDock from "@/components/mathboard/BottomDock";
import SettingsPanel from "@/components/mathboard/SettingsPanel";
import VisualAssistant from "@/components/mathboard/VisualAssistant";
import WorkspaceTabs, { WorkspaceMode } from "@/components/mathboard/WorkspaceTabs";
import SubstitutionWorkspace from "@/components/mathboard/SubstitutionWorkspace";
import ParallelWorkspace from "@/components/mathboard/ParallelWorkspace";
import { MathRender } from "@/components/mathboard/MathRender";

const QuestionHeader = () => {
  const { state, focusContainer } = useMathBoard();
  const q = state.sessions[0];
  if (!q) return null;
  return (
    <div className="px-4 py-2 border-b border-amber-200/15">
      <div className="flex items-baseline gap-3">
        <span className="text-[10px] uppercase tracking-widest text-cyan-300/70 font-semibold">Question</span>
        <span className="text-xs text-muted-foreground italic">Solve / Evaluate:</span>
      </div>
      <div className="overflow-x-auto whitespace-nowrap text-foreground min-h-[2rem] mt-0.5">
        <MathRender
          sessionId={q.id}
          nodes={q.nodes}
          cursor={state.cursor}
          onFocus={(c: Container, i: number) => focusContainer(c, i)}
        />
      </div>
    </div>
  );
};

const SmartStack = () => (
  <div className="flex-1 min-h-0 overflow-hidden">
    <SessionStack />
  </div>
);

const Inner = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceMode>("linear");
  const { type, backspace, moveCursor, submit, undo, redo } = useMathBoard();

  // Physical keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Enter") { e.preventDefault(); submit(); return; }
      if (e.key === "Backspace") { e.preventDefault(); backspace(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); moveCursor(-1, e.shiftKey); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); moveCursor(1, e.shiftKey); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (e.key.length === 1 && /[0-9a-zA-Z+\-*/=.]/.test(e.key)) {
        e.preventDefault(); type(e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [type, backspace, moveCursor, submit, undo, redo]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(244_46%_8%)] via-[hsl(250_38%_12%)] to-[hsl(244_46%_6%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(hsl(200_90%_70%/0.4)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative z-10 flex h-full flex-col">
        <TopHud
          onSettings={() => setSettingsOpen(true)}
          centerSlot={<WorkspaceTabs mode={workspace} onChange={setWorkspace} />}
        />
        <div className="flex flex-1 min-h-0 gap-2 px-2 py-2">
          <main className="flex flex-1 min-w-0 flex-col rounded-2xl border border-amber-200/15 bg-card/30 backdrop-blur overflow-hidden">
            {workspace === "linear" && (
              <>
                <QuestionHeader />
                <SmartStack />
              </>
            )}
            {workspace === "substitution" && <SubstitutionWorkspace />}
            {workspace === "parallel" && <ParallelWorkspace />}
          </main>
          <VisualAssistant />
        </div>
        <BottomDock />
      </div>
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

const MathBoardPage = () => (
  <MathBoardProvider mode="smartboard">
    <Inner />
  </MathBoardProvider>
);

export default MathBoardPage;
