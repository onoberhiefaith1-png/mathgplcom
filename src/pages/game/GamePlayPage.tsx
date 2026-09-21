// GAME PLAY — the Game's own playable experience.
//
// The Game Board (/game/slate/:id) is where a teacher BUILDS the Game.
// A Class only ASSIGNS it. This page is where it is played, and it never
// touches Adventure.
//
// Two existing systems are placed together, unchanged:
//   • the 3D Game Slate world (WorldStage) — the physical world and rewards
//   • the student/mobile Floating Numbers control panel, taken from the
//     Smartboard (PresentationView with chrome="game") — the mathematics,
//     marking and timing
//
// The Game Slate is the ONLY board: the student's working is engraved on the
// physical Game Lines as they write. The Smartboard surface itself is not
// shown. Nothing mathematical is re-implemented here.

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Heart, Hourglass, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadGame } from "@/lib/slate/storage";
import { loadGameAssignmentState } from "@/lib/slate/gameAssignments";
import { ensureGameBoards, loadGameBoards, type GameQuestionBoard } from "@/lib/slate/gameBoard";
import { ensureTestClass } from "@/lib/floating/testBoard";
import { patternLengthOf } from "@/lib/slate/pattern";
import {
  floatingTextForGameLine,
  gameLineFromSlotId,
  gameLineSlotId,
  resolveRenderedLineSlot,
} from "@/lib/slate/lineSurfaces";
import { buildBoardScope, clearBoardScope } from "@/lib/smartboard/boardScope";
import { GameClockDisplay } from "@/components/gameslate/GameClockDisplay";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useGameRuntime } from "@/hooks/useGameRuntime";
import WorldStage from "@/components/gameslate/world/WorldStage";
import PresentationView from "@/components/smartboard/PresentationView";
import { getReward } from "@/lib/slate/rewards";
import { GameLoadingScreen } from "@/components/gameslate/GameLoadingScreen";
import { GAME_STARTUP_DEADLINE_MS } from "@/lib/game/runtime/startup";
import type { Game, RewardInstance, Selection, Slot } from "@/lib/slate/types";


const GamePlayPage = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [boards, setBoards] = useState<GameQuestionBoard[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [worldReady, setWorldReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(10);
  const gameRef = useRef<Game | null>(null);
  const worldReadyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  /** Live working per Floating Numbers line (0-based) → plain text. */
  const [lineText, setLineText] = useState<Record<number, string>>({});
  const pendingLineText = useRef<Record<number, string> | null>(null);
  const lineTextFrame = useRef<number | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const [resetting, setResetting] = useState(false);
  /** Phone only: Exit and Reset live in a small menu so the strip stays short. */
  const [menuOpen, setMenuOpen] = useState(false);
  const phone = useBreakpoint() === "phone";

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { worldReadyRef.current = worldReady; }, [worldReady]);
  useEffect(() => {
    const deadline = window.setTimeout(() => {
      if (worldReadyRef.current) return;
      if (gameRef.current) {
        // The saved Game is present. Expose its core world now; optional visual
        // detail continues behind it instead of extending the loading screen.
        setLoadingProgress(100);
        setWorldReady(true);
        return;
      }
      setLoading(false);
      setError("This Game took too long to open. Please try again.");
    }, GAME_STARTUP_DEADLINE_MS);
    return () => window.clearTimeout(deadline);
  }, []);

  // Floating Numbers remains immediate. Its mirror onto the 3D slate is
  // coalesced to one update per painted frame, so a burst of taps cannot queue
  // several complete scene reconciliations ahead of the timer or next input.
  const mirrorLineText = (next: Record<number, string>) => {
    pendingLineText.current = next;
    if (lineTextFrame.current !== null) return;
    lineTextFrame.current = window.requestAnimationFrame(() => {
      lineTextFrame.current = null;
      const latest = pendingLineText.current;
      pendingLineText.current = null;
      if (latest) startTransition(() => setLineText(latest));
    });
  };
  useEffect(() => () => {
    if (lineTextFrame.current !== null) window.cancelAnimationFrame(lineTextFrame.current);
  }, []);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [userResult, loaded, ownerResult] = await Promise.all([
        supabase.auth.getUser(),
        loadGame(gameId),
        supabase.from("slate_games").select("owner_id").eq("id", gameId).maybeSingle(),
      ]);
      const { data: userData } = userResult;
      const userId = userData.user?.id ?? null;
      const { data: ownerRow } = ownerResult;
      const isOwner = Boolean(userId) && (ownerRow as { owner_id?: string } | null)?.owner_id === userId;
      if (cancelled) return;
      if (!loaded || !userId) {
        setError("This Game is not available.");
        setLoading(false);
        return;
      }
      setUid(userId);
      setGame(loaded);

      try {
        if (isOwner) {
          // Teacher Play / Test: the same runtime, nothing recorded.
          const testClass = await ensureTestClass(userId);
          const built = await ensureGameBoards({ gameId, classId: testClass });
          if (cancelled) return;
          setTestMode(true);
          setClassId(testClass);
          setAssignmentId(null);
          setBoards(built);
        } else {
          const byClass = await loadGameAssignmentState(gameId);
          const assignment = Array.from(byClass.values())[0] ?? null;
          if (!assignment) {
            if (!cancelled) setError("This Game is not assigned to your class.");
            return;
          }
          const loadedBoards = await loadGameBoards({ gameId, classId: assignment.classId });
          if (cancelled) return;
          setClassId(assignment.classId);
          setAssignmentId(assignment.id);
          setBoards(loadedBoards);
          if (loadedBoards.length === 0) {
            setError("Your teacher has not finished preparing this Game's questions yet.");
          }
        }
      } catch {
        if (!cancelled) setError("This Game could not be opened.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gameId]);

  const runtime = useGameRuntime({
    game, boards, studentId: uid, assignmentId, testMode,
    // the Vault compares the student's own working against the wanted method
    lineText,
  });
  const renderedLineText = useDeferredValue(lineText);

  /** ONE selector shared by surfaces, scrolling, the HUD and Floating Numbers.
   *  There is no second copy of the active line: the world's selection is
   *  derived from the runtime, so a tap can never be reversed by a sync. */
  const chosenAtRef = useRef(0);
  const setActiveLine = (line: number, focusInput = false) => {
    if (!Number.isFinite(line) || line < 1 || line >= runtime.lines.length) return;
    chosenAtRef.current = Date.now();
    runtime.selectLine(line);
    if (focusInput) window.dispatchEvent(new CustomEvent("game:focus-floating-input"));
  };

  /** The slate glides to the chosen line. A glide NEVER chooses a line: the
   *  student chooses by touching a writing surface or using the line arrows,
   *  otherwise the glide could drag the chosen line back to a neighbour. */
  const focusSettledLine = (_line: number) => {};

  const surfaceSelection = useMemo<Selection>(
    () => ({ kind: "slot", slotId: gameLineSlotId(Math.max(1, runtime.currentLine)) }),
    [runtime.currentLine],
  );

  // A new question starts on a clean slate — no test or previous working.
  useEffect(() => { setLineText({}); }, [runtime.question?.questionRowId]);

  /* ---- reward celebration -------------------------------------------- */
  // A finished line pays its rewards. The physical object plays its own
  // existing effect where it stands, and only disappears once it has finished.
  const [celebrating, setCelebrating] = useState<string[]>([]);
  const seenRewards = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = runtime.consumedRewardKeys.filter((key) => !seenRewards.current.has(key));
    if (fresh.length === 0) return;
    fresh.forEach((key) => seenRewards.current.add(key));
    setCelebrating((prev) => [...prev, ...fresh]);
    fresh.forEach((key) => {
      const [, line, ...rest] = key.split(":");
      const rewardId = rest.join(":");
      window.dispatchEvent(new CustomEvent("slate:activate-reward", {
        detail: { slotId: gameLineSlotId(Number(line)), rewardId: `${line}-${rewardId}`, preview: false },
      }));
    });
    const handle = window.setTimeout(() => {
      setCelebrating((prev) => prev.filter((key) => !fresh.includes(key)));
    }, 2600);
    return () => window.clearTimeout(handle);
  }, [runtime.consumedRewardKeys]);

  /** The physical slate for THIS question: Line 0 plus one Line per solving line. */
  const displayGame = useMemo<Game | null>(() => {
    if (!game || runtime.lines.length === 0 || !runtime.question) return game;
    const patternLength = patternLengthOf(game);
    const question = runtime.question;
    const slots: Slot[] = runtime.lines.map((row) => {
      // Line 0 is the question, read-only and outside rewards and marks.
      // Every other Game Line carries the student's own live working, and its
      // teaching note only once the line has actually earned its marks.
      const working = row.isQuestion ? "" : floatingTextForGameLine(renderedLineText, row.line);
      const note = row.isQuestion
        ? null
        : runtime.completedLines.includes(row.line)
          ? question.lineNotes[row.line - 1]
          : null;
      const text = row.isQuestion
          ? question.questionText
          : [working, note].filter(Boolean).join("\n");
      const rewards: RewardInstance[] = row.rewards.map((reward) => {
          const key = `${question.questionRowId}:${row.line}:${reward.id}`;
          const used = runtime.consumedRewardKeys.includes(key);
          // it stays on the slate while its own effect is still playing
          const playing = celebrating.includes(key);
          return {
            ...reward,
            id: `${row.line}-${reward.id}`,
            hidden: used && !playing,
            state: used && !playing ? "archived" : "dormant",
          };
        });
      return resolveRenderedLineSlot(game, { ...row, text, rewards });
    });
    return { ...game, slots, patternLength };
  }, [
    game,
    runtime.lines,
    runtime.question,
    runtime.consumedRewardKeys,
    runtime.completedLines,
    renderedLineText,
    celebrating,
  ]);

  const resetGame = async () => {
    if (resetting || !uid) return;
    if (!window.confirm("Reset this run? Your working and progress will be cleared. The saved Game design will stay unchanged.")) return;
    setResetting(true);
    try {
      for (const board of boards) {
        clearBoardScope(buildBoardScope({
          studentId: uid,
          classId,
          workspace: "game",
          gameId,
          assessmentId: board.assessmentId,
          questionId: board.boardQuestionId,
        }));
      }
      if (!testMode) {
        for (const board of boards) {
          await Promise.all([
            supabase.from("assessment_question_board_state").delete()
              .eq("assessment_id", board.assessmentId).eq("student_id", uid),
            supabase.from("assessment_board_state").delete()
              .eq("assessment_id", board.assessmentId).eq("student_id", uid),
            supabase.from("assessment_progress").delete()
              .eq("assessment_id", board.assessmentId).eq("student_id", uid),
            supabase.from("assessment_timer_attempts").delete()
              .eq("assessment_id", board.assessmentId).eq("student_id", uid),
          ]);
        }
      }
      await runtime.restartGame();
      seenRewards.current = new Set();
      setCelebrating([]);
      setLineText({});
      setResetEpoch((value) => value + 1);
      window.dispatchEvent(new CustomEvent("slate:effect-transport", { detail: { action: "clear" } }));
    } finally {
      setResetting(false);
    }
  };


  if (loading) {
    return <GameLoadingScreen className="fixed" progress={10} />;
  }

  if (error || !game) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 p-8">
        <h1 className="text-xl font-semibold">{game?.name ?? "Game"}</h1>
        <p className="text-sm text-muted-foreground">{error ?? "This Game is not available."}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Back
        </button>
      </div>
    );
  }

  // No question attached yet: say so plainly instead of an empty world.
  if (boards.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 p-8">
        <h1 className="text-xl font-semibold">{game.name}</h1>
        <p className="text-sm text-muted-foreground">
          This Game has no question yet. Questions come from your lesson notes: open the lesson
          note, press the 👥 button on the solution, choose Game and pick this Game. Every line of
          the question becomes its own writing surface here.
        </p>
        <div className="flex gap-2">
          {testMode && (
            <button
              type="button"
              onClick={() => navigate(`/game/slate/${gameId}`)}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Open Game Board
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const controls = runtime.question ? (
    <PresentationView
      key={`${buildBoardScope({
        studentId: uid,
        classId,
        workspace: "game",
        gameId,
        assessmentId: runtime.question.assessmentId,
        questionId: runtime.question.boardQuestionId,
      })}:${resetEpoch}`}
      role="student"
      source={runtime.question.boardSource}
      notebookId={runtime.question.notebookId}
      assessmentId={runtime.question.assessmentId}
      classId={classId}
      workspace="game"
      gameId={gameId ?? null}
      boardStudentId={uid}
      boardQuestionId={runtime.question.boardQuestionId}
      testMode={testMode}
      onLineContext={runtime.onLineContext}
      // Only the Floating Numbers control panel is shown; the Game Slate is
      // the board, and Game Lines own line selection.
      chrome="game"
      activeLine={Math.max(0, runtime.currentLine - 1)}
      onActiveLineChange={(line) => setActiveLine(line)}
      onLineText={mirrorLineText}
    />
  ) : null;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      {/* THE BOARD. The Game Slate world is the whole screen. */}
      <div className="absolute inset-0 z-0">
        {displayGame && (
          <WorldStage
            game={displayGame}
            mode="view"
            selection={surfaceSelection}
            onSelect={(selection) => {
              if (selection.kind !== "slot") return;
              const line = gameLineFromSlotId(selection.slotId);
              if (line === null) return;
              setActiveLine(line, true);
            }}
            onSlotChange={() => {}}
            onRewardMove={() => {}}
            onRewardActivate={() => {}}
            onRewardConsume={(slotId, rewardId) => {
              const line = gameLineFromSlotId(slotId);
              if (line !== null) runtime.consumeWorldReward(line, rewardId);
            }}
            /* the slate glides so the active Game Line is the surface in view */
            focusSlotId={gameLineSlotId(runtime.currentLine)}
            /* scrolling only moves the view — it never re-chooses the line */
            onFocusSlot={(slotId) => {
              const line = gameLineFromSlotId(slotId);
              if (line !== null) focusSettledLine(line);
            }}
            /* the mathematics is written by Floating Numbers, never typed here */
            readOnlyWriting
            onReadyChange={setWorldReady}
            onProgressChange={setLoadingProgress}
          />
        )}
      </div>
      {!worldReady ? <GameLoadingScreen className="fixed" progress={loadingProgress} /> : null}

      {/* HUD */}
      {/* HUD — one short strip on a phone, the full row on larger screens. */}
      {phone ? (
        <header className="absolute inset-x-0 top-0 z-20 flex h-10 items-center gap-2 overflow-hidden bg-background/80 px-2 text-[11px] tabular-nums backdrop-blur">
          <span className="inline-flex shrink-0 items-center gap-0.5" title="Question time">
            <Hourglass className="h-3.5 w-3.5 text-sky-500" />
            <GameClockDisplay deadline={runtime.questionDeadline}>
              {(label) => <span>{label}</span>}
            </GameClockDisplay>
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5" title="Line time">
            <Hourglass className="h-3.5 w-3.5 text-emerald-500" />
            <GameClockDisplay deadline={runtime.lineDeadline}>
              {(label) => <span>{label}</span>}
            </GameClockDisplay>
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5" title="Lives">
            <Heart className="h-3.5 w-3.5 text-rose-500" /> {runtime.lives}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5" title="Vault reward">
            <img className="h-3 w-6 object-contain" src={getReward("math-vault").art} alt="" />
            {runtime.vaultReward}
          </span>
          <span
            key={runtime.completionCount}
            className="inline-flex shrink-0 items-center gap-0.5 animate-in zoom-in"
            title="Completed lines"
          >
            <img className="h-3.5 w-3.5 object-contain" src={getReward("mark-seal").art} alt="" />
            {runtime.completionCount}
          </span>
          <span className="shrink-0" title="Marks">
            {runtime.earnedMarks}/{runtime.totalMarks}
          </span>
          <span className="ml-auto shrink-0 truncate opacity-70" title="Current line">
            L{runtime.currentLine}
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Game menu"
            aria-expanded={menuOpen}
            className="shrink-0 rounded border border-border/60 px-2 py-1 text-xs"
          >
            ☰
          </button>
        </header>
      ) : (
        <header className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-3 bg-background/70 px-4 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 rounded border border-border/60 px-2.5 py-1 text-sm hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Exit
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{game.name}</h1>
            <p className="text-xs text-muted-foreground">
              Question {Math.min(runtime.questionIndex + 1, Math.max(1, boards.length))} of {boards.length}
              {" · "}Game Line {runtime.currentLine}
              {testMode ? " · Test play (nothing recorded)" : ""}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm tabular-nums">
            <GameClockDisplay deadline={runtime.questionDeadline}>
              {(label) => (
                <span className="inline-flex items-center gap-1" title="Question time">
                  <Hourglass className="h-4 w-4 text-sky-500" /> TIME {label}
                </span>
              )}
            </GameClockDisplay>
            <GameClockDisplay deadline={runtime.lineDeadline}>
              {(label) => (
                <span className="inline-flex items-center gap-1" title="Line time">
                  <Hourglass className="h-4 w-4 text-emerald-500" /> {label}
                </span>
              )}
            </GameClockDisplay>
            <span className="inline-flex items-center gap-1" title="Lives">
              <Heart className="h-4 w-4 text-rose-500" /> LIFE {runtime.lives}
            </span>
            <span className="inline-flex items-center gap-1" title="Vault reward">
              <img className="h-4 w-8 object-contain" src={getReward("math-vault").art} alt="" /> VAULT {runtime.vaultReward}
            </span>
            <span key={runtime.completionCount} className="inline-flex items-center gap-1 animate-in zoom-in" title="Completed lines">
              <img className="h-4 w-4 object-contain" src={getReward("mark-seal").art} alt="" />
              COMPLETION {runtime.completionCount}
            </span>
            <span className="inline-flex items-center gap-1" title="Marks">
              {runtime.earnedMarks} / {runtime.totalMarks}
              {runtime.totalMarks > 0
                ? ` · ${Math.round((runtime.earnedMarks / runtime.totalMarks) * 100)}%`
                : ""}
            </span>
            <button
              type="button"
              onClick={() => void resetGame()}
              disabled={resetting}
              title="Reset this run"
              className="inline-flex items-center gap-1.5 rounded border border-border/60 px-2.5 py-1 text-xs font-semibold tracking-wide hover:bg-accent disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {resetting ? "RESETTING" : "RESET"}
            </button>
          </div>
        </header>
      )}

      {phone && menuOpen ? (
        <div className="absolute right-2 top-11 z-30 w-48 overflow-hidden rounded-lg border border-border/70 bg-background text-sm shadow-xl">
          <div className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
            {game.name} · Question{" "}
            {Math.min(runtime.questionIndex + 1, Math.max(1, boards.length))} of {boards.length}
            {testMode ? " · Test play" : ""}
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void resetGame();
            }}
            disabled={resetting}
            className="block w-full border-b border-border/60 px-3 py-2.5 text-left disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "Reset this run"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              navigate(-1);
            }}
            className="block w-full px-3 py-2.5 text-left"
          >
            Exit Game
          </button>
        </div>
      ) : null}

      {runtime.message && (
        <div className="absolute inset-x-0 top-12 z-20 mx-auto flex w-fit items-center gap-3 rounded-full bg-primary/90 px-4 py-1.5 text-xs text-primary-foreground">
          <span>{runtime.message}</span>
          <button type="button" onClick={runtime.dismissMessage} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* THE CONTROLS. The existing student Floating Numbers panel, docked at
          the front of the Game. Everything else the Smartboard renders is
          hidden by its game chrome. */}
      {runtime.status === "complete" ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/85 text-center backdrop-blur">
          <h2 className="text-lg font-semibold">Game complete</h2>
          <p className="text-sm text-muted-foreground">
             {runtime.earnedMarks} / {runtime.totalMarks} marks · {runtime.vaultReward} vault · {runtime.completionCount} completed
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void resetGame()}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Finish
            </button>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 z-10">{controls}</div>
      )}
    </div>
  );
};

export default GamePlayPage;
