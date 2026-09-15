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

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Coins, Heart, Hourglass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadGame } from "@/lib/slate/storage";
import { loadGameAssignmentState } from "@/lib/slate/gameAssignments";
import { ensureGameBoards, loadGameBoards, type GameQuestionBoard } from "@/lib/slate/gameBoard";
import { ensureTestClass } from "@/lib/floating/testBoard";
import { patternLengthOf } from "@/lib/slate/pattern";
import { buildBoardScope } from "@/lib/smartboard/boardScope";
import { formatMmSs } from "@/lib/time/mmss";
import { useGameRuntime } from "@/hooks/useGameRuntime";
import WorldStage from "@/components/gameslate/world/WorldStage";
import PresentationView from "@/components/smartboard/PresentationView";
import type { Game, Slot } from "@/lib/slate/types";

const secondsLeft = (deadline: number | null) =>
  deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;

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
  const [error, setError] = useState<string | null>(null);
  /** Live working per Floating Numbers line (0-based) → plain text. */
  const [lineText, setLineText] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const loaded = await loadGame(gameId);
      const { data: ownerRow } = await supabase
        .from("slate_games")
        .select("owner_id")
        .eq("id", gameId)
        .maybeSingle();
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

  const runtime = useGameRuntime({ game, boards, studentId: uid, assignmentId, testMode });

  // A new question starts on a clean slate — no test or previous working.
  useEffect(() => { setLineText({}); }, [runtime.question?.questionRowId]);

  /** The physical slate for THIS question: Line 0 plus one Line per solving line. */
  const displayGame = useMemo<Game | null>(() => {
    if (!game || runtime.lines.length === 0 || !runtime.question) return game;
    const patternLength = patternLengthOf(game);
    const question = runtime.question;
    const slots: Slot[] = runtime.lines.map((row) => {
      const base = game.slots[row.isQuestion ? 0 : Math.max(0, row.patternSlot - 1)]
        ?? game.slots[0];
      // Line 0 is the question, read-only and outside rewards and marks.
      // Every other Game Line carries the student's own live working, and its
      // teaching note only once the line has actually earned its marks.
      const working = row.isQuestion ? "" : (lineText[row.line - 1] ?? "");
      const note = row.isQuestion
        ? null
        : runtime.completedLines.includes(row.line)
          ? question.lineNotes[row.line - 1]
          : null;
      return {
        ...base,
        id: `line-${row.line}`,
        text: row.isQuestion
          ? question.questionText
          : [note, working].filter(Boolean).join("\n"),
        hiddenContent: "",
        contentState: "visible",
        rewards: row.rewards.map((reward) => {
          const key = `${question.questionRowId}:${row.line}:${reward.id}`;
          const used = runtime.consumedRewardKeys.includes(key);
          return {
            ...reward,
            id: `${row.line}-${reward.id}`,
            hidden: used,
            state: used ? "archived" : row.line === runtime.currentLine ? "active" : "dormant",
          };
        }),
      };
    });
    return { ...game, slots, patternLength };
  }, [
    game,
    runtime.lines,
    runtime.question,
    runtime.consumedRewardKeys,
    runtime.currentLine,
    runtime.completedLines,
    lineText,
  ]);

  const questionRemaining = secondsLeft(runtime.questionDeadline);
  const lineRemaining = secondsLeft(runtime.lineDeadline);
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!runtime.questionDeadline && !runtime.lineDeadline) return;
    const tick = window.setInterval(() => forceTick((n) => n + 1), 500);
    return () => window.clearInterval(tick);
  }, [runtime.questionDeadline, runtime.lineDeadline]);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading Game…</div>;
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

  const controls = runtime.question ? (
    <PresentationView
      key={buildBoardScope({
        studentId: uid,
        classId,
        workspace: "game",
        gameId,
        assessmentId: runtime.question.assessmentId,
        questionId: runtime.question.boardQuestionId,
      })}
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
      onLineText={setLineText}
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
            selection={{ kind: "none" }}
            onSelect={(selection) => {
              if (selection.kind !== "slot") return;
              const line = Number(String(selection.id).replace("line-", ""));
              if (Number.isFinite(line)) runtime.selectLine(line);
            }}
            onSlotChange={() => {}}
            onRewardMove={() => {}}
            onRewardActivate={() => {}}
            onRewardConsume={() => {}}
          />
        )}
      </div>

      {/* HUD */}
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
          <span className="inline-flex items-center gap-1" title="Coins">
            <Coins className="h-4 w-4 text-amber-500" /> {runtime.coins}
          </span>
          <span className="inline-flex items-center gap-1" title="Lives">
            <Heart className="h-4 w-4 text-rose-500" /> {runtime.lives}
          </span>
          {questionRemaining > 0 && (
            <span className="inline-flex items-center gap-1" title="Question time">
              <Hourglass className="h-4 w-4 text-sky-500" /> {formatMmSs(questionRemaining)}
            </span>
          )}
          {lineRemaining > 0 && (
            <span className="inline-flex items-center gap-1" title="Line time">
              <Hourglass className="h-4 w-4 text-emerald-500" /> {formatMmSs(lineRemaining)}
            </span>
          )}
          <span className="inline-flex items-center gap-1" title="Marks">
            {runtime.earnedMarks} / {runtime.totalMarks}
            {runtime.totalMarks > 0
              ? ` · ${Math.round((runtime.earnedMarks / runtime.totalMarks) * 100)}%`
              : ""}
          </span>
        </div>
      </header>

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
            {runtime.earnedMarks} / {runtime.totalMarks} marks · {runtime.coins} coins
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runtime.restartGame}
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
