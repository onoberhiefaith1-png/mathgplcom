// Decimal challenge game — reuses the MathBoard engine, helper rail, keyboard,
// and gamification from the fraction challenge. Differentiated by `kind` and
// `difficulty` from URL params.

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { MathBoardProvider, useMathBoard, CustomValidator } from "@/hooks/useMathBoard";
import TopHud from "@/components/mathboard/TopHud";
import SessionStack from "@/components/mathboard/SessionStack";
import Keyboard from "@/components/mathboard/Keyboard";
import SettingsPanel from "@/components/mathboard/SettingsPanel";
import MathBoardFlyingRewards from "@/components/mathboard/FlyingRewards";
import { FractionGameProvider, TIMER_OPTIONS, useFractionGame } from "@/contexts/FractionGameContext";
import HelperRail from "@/components/fraction-challenge/HelperRail";
import QuestionTimer from "@/components/fraction-challenge/QuestionTimer";
import { Node } from "@/lib/mathboard/tokens";
import { DecimalKind, Difficulty, generateDecimal, GeneratedDecimal } from "@/lib/decimals/generator";
import { validateDecimalRow } from "@/lib/decimals/validator";
import { ChallengeMode } from "@/hooks/useFractionStep";

interface InnerProps {
  kind: DecimalKind;
  difficulty: Difficulty;
  helperMode?: ChallengeMode;
  qRef: React.MutableRefObject<GeneratedDecimal | null>;
}

const Inner = ({ kind, difficulty, helperMode, qRef }: InnerProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { type, backspace, moveCursor, submit, undo, redo, loadQuestion, state } = useMathBoard();
  const { duration, setDuration, setPaused, bumpReset, objectiveTarget } = useFractionGame();

  const [questionNodes, setQuestionNodes] = useState<Node[] | null>(null);

  const loadNew = useCallback(() => {
    const q = generateDecimal(kind, difficulty);
    qRef.current = q;
    setQuestionNodes(q.nodes);
    loadQuestion(q.nodes);
    bumpReset();
  }, [kind, difficulty, loadQuestion, bumpReset, qRef]);

  // Initial load
  useEffect(() => { loadNew(); }, [loadNew]);

  // Pause timer while settings is open
  useEffect(() => { setPaused(settingsOpen); }, [settingsOpen, setPaused]);

  // Mirror question session changes back to local state for the helper rail.
  useEffect(() => {
    const q = state.sessions[0];
    if (q && q.nodes !== questionNodes) setQuestionNodes(q.nodes);
  }, [state.sessions, questionNodes]);

  // Auto-advance after a "final" submission
  const lastFinal = useRef(state.finalCount);
  useEffect(() => {
    if (state.finalCount > lastFinal.current) {
      lastFinal.current = state.finalCount;
      const t = setTimeout(loadNew, 1200);
      return () => clearTimeout(t);
    }
  }, [state.finalCount, loadNew]);

  const handleTimeout = useCallback(() => {
    loadNew();
  }, [loadNew]);

  // Physical keyboard
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
          backTo={`/games/decimals/${kind}`}
          rightSlot={<QuestionTimer onTimeout={handleTimeout} />}
          objectives={objectiveTarget}
        />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-w-0">
            <SessionStack />
          </main>
          <aside className="hidden md:flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-amber-200/15 bg-card/30 px-3 py-4 backdrop-blur">
            <HelperRail questionNodes={questionNodes} mode={helperMode} />
          </aside>
        </div>
        <Keyboard />
      </div>
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        timer={{
          duration,
          setDuration: (s) => setDuration(s as 30 | 60 | 120 | 180 | 300),
          options: TIMER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
        }}
      />
      <MathBoardFlyingRewards />
    </div>
  );
};

const helperModeFor = (kind: DecimalKind): ChallengeMode | undefined => {
  if (kind === "mul") return "multiplication";
  if (kind === "div") return "division";
  if (kind === "mixed") return "mul-div";
  if (kind === "add") return "addition";
  if (kind === "sub") return "subtraction";
  return undefined;
};

const Game = ({ kind, difficulty }: { kind: DecimalKind; difficulty: Difficulty }) => {
  const qRef = useRef<GeneratedDecimal | null>(null);

  const validator = useCallback<CustomValidator>((studentNodes) => {
    const cur = qRef.current;
    if (!cur) return { status: "invalid" };
    const r = validateDecimalRow(studentNodes, cur);
    if (r.status === "final") return { status: "final" };
    if (r.status === "equivalent") return { status: "equivalent" };
    return { status: "invalid" };
  }, []);

  return (
    <FractionGameProvider difficulty={difficulty}>
      <MathBoardProvider validator={validator}>
        <Inner kind={kind} difficulty={difficulty} helperMode={helperModeFor(kind)} qRef={qRef} />
      </MathBoardProvider>
    </FractionGameProvider>
  );
};

const useDifficulty = (): Difficulty => {
  const { difficulty } = useParams<{ difficulty: string }>();
  return (difficulty === "medium" || difficulty === "hard") ? difficulty : "easy";
};

const useKind = (): DecimalKind => {
  const { kind } = useParams<{ kind: string }>();
  const valid: DecimalKind[] = ["frac-to-dec", "dec-to-frac", "add", "sub", "mul", "div", "mixed"];
  return (valid.includes(kind as DecimalKind) ? kind : "add") as DecimalKind;
};

const DecimalChallengeGame = () => <Game kind={useKind()} difficulty={useDifficulty()} />;
export default DecimalChallengeGame;
