import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { MathBoardProvider, useMathBoard, CustomValidator } from "@/hooks/useMathBoard";
import TopHud from "@/components/mathboard/TopHud";
import SessionStack from "@/components/mathboard/SessionStack";
import Keyboard from "@/components/mathboard/Keyboard";
import SettingsPanel from "@/components/mathboard/SettingsPanel";
import MathBoardFlyingRewards from "@/components/mathboard/FlyingRewards";
import { ChallengeKind, Difficulty, generateQuestion, GeneratedQuestion } from "@/lib/fraction-challenge/generator";
import { validateRow } from "@/lib/fraction-challenge/validator";
import { FractionGameProvider, TIMER_OPTIONS, useFractionGame } from "@/contexts/FractionGameContext";
import HelperRail from "@/components/fraction-challenge/HelperRail";
import QuestionTimer from "@/components/fraction-challenge/QuestionTimer";
import { Node } from "@/lib/mathboard/tokens";

interface InnerProps {
  kind: ChallengeKind;
  difficulty: Difficulty;
}

const Inner = ({ kind, difficulty }: InnerProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { type, backspace, moveCursor, submit, undo, redo, loadQuestion, state } = useMathBoard();
  const { duration, setDuration, setPaused, bumpReset, objectiveTarget } = useFractionGame();

  // Generate first question once at mount.
  const questionRef = useRef<GeneratedQuestion | null>(null);
  const [questionNodes, setQuestionNodes] = useState<Node[] | null>(null);

  const loadNew = useCallback(() => {
    const q = generateQuestion(kind, difficulty);
    questionRef.current = q;
    setQuestionNodes(q.nodes);
    loadQuestion(q.nodes);
    bumpReset();
  }, [kind, difficulty, loadQuestion, bumpReset]);

  useEffect(() => { loadNew(); }, [loadNew]);

  // Pause timer while settings is open
  useEffect(() => { setPaused(settingsOpen); }, [settingsOpen, setPaused]);

  // Mirror the live question session into questionNodes (so the helper hook re-runs).
  useEffect(() => {
    const q = state.sessions[0];
    if (q && q.nodes !== questionNodes) {
      setQuestionNodes(q.nodes);
    }
  }, [state.sessions, questionNodes]);

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
          backTo={`/games/fraction-challenge/${kind}`}
          rightSlot={<QuestionTimer onTimeout={handleTimeout} />}
          objectives={objectiveTarget}
        />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-w-0">
            <SessionStack />
          </main>
          <aside className="hidden md:flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-amber-200/15 bg-card/30 px-3 py-4 backdrop-blur">
            <HelperRail questionNodes={questionNodes} mode={kind} />
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

const Game = ({ kind, difficulty }: InnerProps) => {
  // Validator: compare each submitted row against session[0] (the question).
  const validator = useCallback<CustomValidator>((studentNodes, sessions, _idx) => {
    const q = sessions[0];
    if (!q) return { status: "invalid" };
    const r = validateRow(studentNodes, q.nodes);
    if (r.status === "final") return { status: "final" };
    if (r.status === "equivalent") return { status: "equivalent" };
    return { status: "invalid" };
  }, []);

  return (
    <FractionGameProvider difficulty={difficulty}>
      <MathBoardProvider validator={validator}>
        <Advancer kind={kind} difficulty={difficulty} />
        <Inner kind={kind} difficulty={difficulty} />
      </MathBoardProvider>
    </FractionGameProvider>
  );
};

/** Watches finalCount and loads a new question after a brief delay. */
const Advancer = ({ kind, difficulty }: InnerProps) => {
  const { state, loadQuestion } = useMathBoard();
  const { bumpReset } = useFractionGame();
  const lastCount = useRef(state.finalCount);
  useEffect(() => {
    if (state.finalCount > lastCount.current) {
      lastCount.current = state.finalCount;
      const t = setTimeout(() => {
        const q = generateQuestion(kind, difficulty);
        loadQuestion(q.nodes);
        bumpReset();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state.finalCount, kind, difficulty, loadQuestion, bumpReset]);
  return null;
};

const useDifficulty = (): Difficulty => {
  const { difficulty } = useParams<{ difficulty: string }>();
  return (difficulty === "medium" || difficulty === "hard") ? difficulty : "easy";
};

export const FractionAdditionGame = () => <Game kind="addition" difficulty={useDifficulty()} />;
export const FractionSubtractionGame = () => <Game kind="subtraction" difficulty={useDifficulty()} />;
export const FractionMixedGame = () => <Game kind="mixed" difficulty={useDifficulty()} />;
export const FractionMultiplicationGame = () => <Game kind="multiplication" difficulty={useDifficulty()} />;
export const FractionDivisionGame = () => <Game kind="division" difficulty={useDifficulty()} />;
export const FractionMulDivGame = () => <Game kind="mul-div" difficulty={useDifficulty()} />;

export default FractionAdditionGame;
