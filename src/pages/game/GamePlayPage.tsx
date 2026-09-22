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

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, ListOrdered, Map, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadGame } from "@/lib/slate/storage";
import {
  listGameClasses,
  loadGameAssignmentState,
  type GameAssignment,
  type GameClassOption,
} from "@/lib/slate/gameAssignments";
import { ensureGameBoards, loadGameBoards, type GameQuestionBoard } from "@/lib/slate/gameBoard";
import { ensureTestClass } from "@/lib/floating/testBoard";
import { patternLengthOf } from "@/lib/slate/pattern";
import {
  floatingTextForGameLine,
  gameLineDisplayText,
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
import { getReward, rewardMayFire } from "@/lib/slate/rewards";
import { GameLoadingScreen } from "@/components/gameslate/GameLoadingScreen";
import { GAME_STARTUP_DEADLINE_MS } from "@/lib/game/runtime/startup";
import { GameEvaluationPanel } from "@/components/gameslate/GameEvaluationPanel";
import GameLevelMap, { type LevelMapNode } from "@/components/gameslate/GameLevelMap";
import LevelArrangeDialog from "@/components/gameslate/LevelArrangeDialog";
import SelectClassDialog from "@/components/gameslate/SelectClassDialog";
import { predict, routeMapFor } from "@/lib/predictive/predictiveLine";
import {
  appendEvent,
  buildLineReport,
  MATH_STATUS_LABEL,
  type InspectEvent,
  type InspectVerdict,
} from "@/lib/game/inspector";
import { localLiveChannel, subscribeLocalLive } from "@/lib/smartboard/localLiveBridge";
import { normalizeConversion } from "@/lib/slate/conversion";
import type { Game, RewardInstance, Selection, Slot } from "@/lib/slate/types";


const GamePlayPage = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  // Guest links and Autoplay carry the instance they mean.
  const requestedClassId = searchParams.get("classId");
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [boards, setBoards] = useState<GameQuestionBoard[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [assignment, setAssignment] = useState<GameAssignment | null>(null);
  /** Owner with several classes: which playable instance to open. */
  const [classChoices, setClassChoices] = useState<GameClassOption[]>([]);
  const [chosenClassId, setChosenClassId] = useState<string | null>(requestedClassId);
  const [mapOpen, setMapOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [boardsEpoch, setBoardsEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [worldReady, setWorldReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(10);
  const gameRef = useRef<Game | null>(null);
  const worldReadyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  /** Live working per Floating Numbers line (0-based) → plain text. */
  const [lineText, setLineText] = useState<Record<number, string>>({});
  /** The same working for the writing surfaces, carrying the sensor mark and
   *  the placeholder box of any empty bracket / fraction / exponent slot. */
  const [displayLineText, setDisplayLineText] = useState<Record<number, string>>({});
  const pendingLineText = useRef<Record<number, string> | null>(null);
  const pendingDisplayText = useRef<Record<number, string> | null>(null);
  const lineTextFrame = useRef<number | null>(null);
  const displayTextFrame = useRef<number | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const [resetting, setResetting] = useState(false);
  /** Phone only: Exit and Reset live in a small menu so the strip stays short. */
  const [menuOpen, setMenuOpen] = useState(false);
  const phone = useBreakpoint() === "phone";

  /* ---- GAME EVALUATION (teacher Play / Test only) ---------------------
   * A pure observer: it reads the Game's own state and the verdicts the board
   * already publishes. It never grades, never selects a line, never writes. */
  const [evalOpen, setEvalOpen] = useState(false);
  /** Latest grading verdict per board line id, exactly as the engine reported. */
  const [verdicts, setVerdicts] = useState<Record<string, InspectVerdict>>({});
  const [expectedLines, setExpectedLines] = useState<Record<string, string>>({});
  // The Floating Numbers the teacher generated for each line — the only pieces
  // the Predictive Line Engine may use when it plots the remaining route.
  const [expectedAtoms, setExpectedAtoms] = useState<Record<string, string[]>>({});
  const [events, setEvents] = useState<InspectEvent[]>([]);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { worldReadyRef.current = worldReady; }, [worldReady]);
  useEffect(() => {
    const deadline = window.setTimeout(() => {
      if (worldReadyRef.current) return;
      if (gameRef.current) {
        // The saved Game is present. Expose its core world now; optional visual
        // detail and question preparation continue behind it instead of
        // extending the loading screen past its promise.
        setLoading(false);
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
      if (latest) setLineText(latest);
    });
  };
  const mirrorDisplayText = (next: Record<number, string>) => {
    pendingDisplayText.current = next;
    if (displayTextFrame.current !== null) return;
    displayTextFrame.current = window.requestAnimationFrame(() => {
      displayTextFrame.current = null;
      const latest = pendingDisplayText.current;
      pendingDisplayText.current = null;
      if (latest) setDisplayLineText(latest);
    });
  };
  useEffect(() => () => {
    if (lineTextFrame.current !== null) window.cancelAnimationFrame(lineTextFrame.current);
    if (displayTextFrame.current !== null) window.cancelAnimationFrame(displayTextFrame.current);
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
          const byClass = await loadGameAssignmentState(gameId);
          const classes = await listGameClasses(gameId);
          if (cancelled) return;
          setClassChoices(classes);
          // CLASS + GAME is the playable instance. With more than one class and
          // no choice yet, the teacher picks before anything is compiled.
          const wanted = chosenClassId && classes.some((c) => c.classId === chosenClassId)
            ? chosenClassId
            : classes.length === 1
              ? classes[0].classId
              : null;
          if (!wanted) {
            if (classes.length === 0) {
              // Never assigned: the Game's own pool, nothing recorded.
              const testClass = await ensureTestClass(userId);
              const built = await ensureGameBoards({
                gameId, classId: testClass, questionClassId: null,
              });
              if (cancelled) return;
              setTestMode(true);
              setClassId(testClass);
              setAssignment(null);
              setAssignmentId(null);
              setBoards(built);
            }
            return;
          }
          const own = byClass.get(wanted) ?? null;
          const built = await ensureGameBoards({ gameId, classId: wanted });
          if (cancelled) return;
          // The teacher plays the real instance, but nothing is recorded.
          setTestMode(true);
          setClassId(wanted);
          setAssignment(own);
          setAssignmentId(null);
          setBoards(built);
        } else {
          const byClass = await loadGameAssignmentState(gameId);
          const assignment =
            (requestedClassId ? byClass.get(requestedClassId) : null)
            ?? Array.from(byClass.values())[0]
            ?? null;
          if (!assignment) {
            if (!cancelled) setError("This Game is not assigned to your class.");
            return;
          }
          const loadedBoards = await loadGameBoards({ gameId, classId: assignment.classId });
          if (cancelled) return;
          setClassId(assignment.classId);
          setAssignment(assignment);
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
  }, [gameId, chosenClassId, requestedClassId, boardsEpoch]);

  const runtime = useGameRuntime({
    game, boards, studentId: uid, assignmentId, testMode,
    // the Vault compares the student's own working against the wanted method
    lineText,
    startingLives: assignment?.startingLives ?? 3,
    lockProgression: assignment?.lockProgression ?? false,
  });

  /** Every assigned Question of this instance is one Level on the map. */
  const levelNodes = useMemo<LevelMapNode[]>(
    () => boards.map((board, index) => ({
      id: board.questionRowId,
      title: board.questionText || board.title || `Level ${index + 1}`,
      earned: runtime.completedQuestionIds.includes(board.questionRowId) ? board.totalMarks : 0,
      total: board.totalMarks,
      completed: runtime.completedQuestionIds.includes(board.questionRowId),
      unlocked: runtime.isLevelUnlocked(index),
    })),
    [boards, runtime.completedQuestionIds, runtime.isLevelUnlocked],
  );
  // The working reaches the slab on the next painted frame — no further
  // deferral layers sit between a tap and the letters appearing.
  // The working reaching the slab carries the sensor and slot marks; the plain
  // `lineText` stays the only mathematical source (Vault, marking, inspector).
  const renderedLineText = displayLineText;

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
  /** Rewards already paid in an earlier sitting must never replay on opening. */
  const primed = useRef(false);
  useEffect(() => {
    if (!runtime.ready || primed.current) return;
    primed.current = true;
    runtime.consumedRewardKeys.forEach((key) => seenRewards.current.add(key));
  }, [runtime.ready, runtime.consumedRewardKeys]);
  useEffect(() => {
    if (!primed.current) return;
    const fresh = runtime.consumedRewardKeys.filter((key) => !seenRewards.current.has(key));
    if (fresh.length === 0) return;
    fresh.forEach((key) => seenRewards.current.add(key));
    setCelebrating((prev) => [...prev, ...fresh]);
    fresh.forEach((key) => {
      const [, line, ...rest] = key.split(":");
      const rewardId = rest.join(":");
      const lineNumber = Number(line);
      // ONE GATE, shared with the tests: an object performs its effect only
      // because its own line was marked correct, or because it is a Vault the
      // student's own mathematics opened.
      if (!rewardMayFire({ line: lineNumber, rewardId, completedLines: runtime.completedLines })) return;
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("slate:activate-reward", {
          detail: { slotId: gameLineSlotId(lineNumber), rewardId: `${line}-${rewardId}`, preview: false, force: true },
        }));
      });
    });
    const handle = window.setTimeout(() => {
      setCelebrating((prev) => prev.filter((key) => !fresh.includes(key)));
    }, 2600);
    return () => window.clearTimeout(handle);
  }, [runtime.consumedRewardKeys, runtime.completedLines]);


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
      const text = gameLineDisplayText({
        isQuestion: row.isQuestion,
        questionText: question.questionText,
        working,
        note: question.lineNotes[row.line - 1],
        awarded: runtime.completedLines.includes(row.line),
      });
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
            // An Hourglass runs ONLY while its own line is the engaged line.
            ...(reward.type === "time-shard"
              ? { armed: runtime.timedLine === row.line }
              : {}),
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
    runtime.timedLine,
    renderedLineText,
    celebrating,
  ]);

  /* ---- Game Evaluation observers -------------------------------------- */
  // The expected line is the teacher's own answer key. It is read only in the
  // owner's Play / Test sitting, where the row's owner-only policy applies.
  const assessmentId = runtime.question?.assessmentId ?? null;
  useEffect(() => {
    if (!testMode || !assessmentId) { setExpectedLines({}); setExpectedAtoms({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("assessment_answer_keys")
        .select("lines")
        .eq("assessment_id", assessmentId)
        .maybeSingle();
      if (cancelled) return;
      const rows = ((data as { lines?: unknown } | null)?.lines ?? []) as {
        lineId?: string; equationAscii?: string; tokens?: string[];
      }[];
      const map: Record<string, string> = {};
      const atoms: Record<string, string[]> = {};
      for (const row of rows) {
        if (!row?.lineId) continue;
        map[row.lineId] = row.equationAscii ?? (row.tokens ?? []).join(" ");
        atoms[row.lineId] = (row.tokens ?? []).filter(Boolean);
      }
      setExpectedLines(map);
      setExpectedAtoms(atoms);
    })();
    return () => { cancelled = true; };
  }, [testMode, assessmentId]);

  // Verdicts: the board already publishes every check on its in-page live feed.
  // Listening changes nothing about grading — it only mirrors what happened.
  useEffect(() => {
    if (!testMode || !assessmentId || !uid) return;
    return subscribeLocalLive(localLiveChannel(assessmentId, uid), "check", (payload) => {
      const info = payload as {
        lineId?: string; correct?: boolean; verdict?: string; marks?: number; studentAscii?: string;
      };
      if (!info?.lineId) return;
      setVerdicts((prev) => ({
        ...prev,
        [info.lineId as string]: {
          lineId: info.lineId as string,
          correct: !!info.correct,
          verdict: info.verdict,
          marks: Number(info.marks ?? 0),
          studentAscii: info.studentAscii ?? "",
          at: Date.now(),
        },
      }));
    });
  }, [testMode, assessmentId, uid]);

  const conversion = useMemo(
    () => normalizeConversion(game?.settings.conversion, game?.settings.life?.multiplier),
    [game],
  );

  /** ONE active line feeds the inspector — the very line the Game is on. */
  const lineReport = useMemo(() => {
    const question = runtime.question;
    if (!question) return null;
    const row = runtime.lines.find((l) => l.line === runtime.currentLine)
      ?? runtime.lines.find((l) => l.line === 1)
      ?? null;
    if (!row) return null;
    const lineId = row.lineId;
    // The Predictive Line comes from the ONE shared engine. The Game never
    // marks with it: it only reports the shortest remaining route.
    const expectedAscii = row.isQuestion ? "" : (lineId ? expectedLines[lineId] ?? "" : "");
    const studentAscii = row.isQuestion
      ? question.questionText
      : floatingTextForGameLine(lineText, row.line);
    const prediction = !row.isQuestion && expectedAscii
      ? predict({
          routeMap: routeMapFor({
            expectedAscii,
            atoms: (lineId ? expectedAtoms[lineId] : undefined) ?? [],
            keyPrefix: `${question.questionRowId}:${lineId ?? row.line}`,
          }),
          studentAscii,
        })
      : null;
    return buildLineReport({
      prediction,
      row,
      questionRowId: question.questionRowId,
      expected: row.isQuestion
        ? question.questionText
        : (lineId ? expectedLines[lineId] ?? null : null),
      student: studentAscii,
      note: row.isQuestion ? null : question.lineNotes[row.line - 1] ?? null,
      lineMarks: row.isQuestion ? 0 : question.lineMarks[row.line - 1] ?? 0,
      awarded: runtime.completedLines.includes(row.line),
      consumedRewardKeys: runtime.consumedRewardKeys,
      verdict: lineId ? verdicts[lineId] ?? null : null,
      timedLine: runtime.timedLine,
      hourglassToTime: conversion.hourglassToTime,
      lifeToTime: conversion.lifeToTime,
    });
  }, [
    runtime.question, runtime.lines, runtime.currentLine, runtime.completedLines,
    runtime.consumedRewardKeys, runtime.timedLine, lineText, expectedLines, expectedAtoms,
    verdicts, conversion,
  ]);


  // Live activity. Every entry corresponds to a real change in Game state.
  const lastEventRef = useRef({ line: 0, status: "", vaults: -1, completion: -1, timed: -1 });
  useEffect(() => {
    if (!testMode || !lineReport) return;
    const seen = lastEventRef.current;
    const push = (text: string) => setEvents((prev) => appendEvent(prev, text));
    if (seen.line !== lineReport.line) {
      seen.line = lineReport.line;
      seen.status = "";
      push(`Line ${lineReport.line} started`);
    }
    if (seen.status !== lineReport.status) {
      seen.status = lineReport.status;
      push(`Line ${lineReport.line}: ${MATH_STATUS_LABEL[lineReport.status]}`);
      if (lineReport.scoreAwarded) {
        push(`Score awarded: ${lineReport.lineMarks} mark(s) on line ${lineReport.line}`);
        if (lineReport.hasNote) push(`Note unlocked on line ${lineReport.line}`);
      }
    }
    if (seen.vaults !== runtime.vaultsOpened) {
      if (seen.vaults >= 0 && runtime.vaultsOpened > seen.vaults) {
        push(`Vault unlocked — no mark awarded (${runtime.vaultsOpened}/${runtime.vaultsTotal})`);
      }
      seen.vaults = runtime.vaultsOpened;
    }
    if (seen.completion !== runtime.completionCount) {
      if (seen.completion >= 0 && runtime.completionCount > seen.completion) {
        push(`Completion coin collected (${runtime.completionCount})`);
      }
      seen.completion = runtime.completionCount;
    }
    const timed = runtime.timedLine ?? 0;
    if (seen.timed !== timed) {
      seen.timed = timed;
      if (timed) push(`Hourglass active on line ${timed}`);
    }
  }, [
    testMode, lineReport, runtime.vaultsOpened, runtime.vaultsTotal,
    runtime.completionCount, runtime.timedLine,
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
      setVerdicts({});
      setEvents([]);
      lastEventRef.current = { line: 0, status: "", vaults: -1, completion: -1, timed: -1 };
      window.dispatchEvent(new CustomEvent("slate:effect-transport", { detail: { action: "clear" } }));
    } finally {
      setResetting(false);
    }
  };


  if (loading) {
    return <GameLoadingScreen className="fixed" progress={10} />;
  }

  // CLASS + GAME is the playable instance, so the owner of a Game used by
  // several classes says which one before anything is compiled.
  if (!error && game && classChoices.length > 1 && !classId) {
    return (
      <SelectClassDialog
        options={classChoices}
        onPick={(option) => setChosenClassId(option.classId)}
        onPickTest={async () => {
          if (!uid || !gameId) return;
          const testClass = await ensureTestClass(uid);
          const built = await ensureGameBoards({
            gameId, classId: testClass, questionClassId: null,
          });
          setTestMode(true);
          setClassId(testClass);
          setAssignment(null);
          setAssignmentId(null);
          setBoards(built);
        }}
        onClose={() => navigate(-1)}
      />
    );
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
      onLineAward={runtime.onLineAward}
      // Only the Floating Numbers control panel is shown; the Game Slate is
      // the board, and Game Lines own line selection.
      chrome="game"
      activeLine={Math.max(0, runtime.currentLine - 1)}
      onActiveLineChange={(line) => setActiveLine(line)}
      onLineText={mirrorLineText}
      onLineDisplayText={mirrorDisplayText}
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
            <img className="h-3.5 w-3.5 object-contain" src={getReward("time-shard").art} alt="" />
            <GameClockDisplay deadline={runtime.questionDeadline}>
              {(label) => <span>{label}</span>}
            </GameClockDisplay>
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5" title="Line time">
            <img className="h-3.5 w-3.5 object-contain" src={getReward("time-shard").art} alt="" />
            <GameClockDisplay deadline={runtime.lineDeadline}>
              {(label) => <span>{label}</span>}
            </GameClockDisplay>
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5" title="Lives">
            <img className="h-3.5 w-3.5 object-contain" src={getReward("retry-heart").art} alt="" /> {runtime.lives}
          </span>
          <span
            className="inline-flex shrink-0 items-center gap-0.5"
            title={`${runtime.vaultsOpened} of ${runtime.vaultsTotal} vaults opened`}
          >
            <img className="h-3 w-6 object-contain" src={getReward("math-vault").art} alt="" />
            {runtime.vaultsOpened}
            <span className="opacity-50">/{runtime.vaultsTotal}</span>
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
                  <img className="h-4 w-4 object-contain" src={getReward("time-shard").art} alt="" /> TIME {label}
                </span>
              )}
            </GameClockDisplay>
            <GameClockDisplay deadline={runtime.lineDeadline}>
              {(label) => (
                <span className="inline-flex items-center gap-1" title="Line time">
                  <img className="h-4 w-4 object-contain" src={getReward("time-shard").art} alt="" /> {label}
                </span>
              )}
            </GameClockDisplay>
            <span className="inline-flex items-center gap-1" title="Lives">
              <img className="h-4 w-4 object-contain" src={getReward("retry-heart").art} alt="" /> LIFE {runtime.lives}
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={`${runtime.vaultsOpened} of ${runtime.vaultsTotal} vaults opened · ${runtime.vaultReward} reward`}
            >
              <img className="h-4 w-8 object-contain" src={getReward("math-vault").art} alt="" /> VAULT{" "}
              {runtime.vaultsOpened}
              <span className="opacity-50">/{runtime.vaultsTotal}</span>
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
              onClick={() => setMapOpen(true)}
              title="Your journey"
              className="inline-flex items-center gap-1.5 rounded border border-border/60 px-2.5 py-1 text-xs font-semibold tracking-wide hover:bg-accent"
            >
              <Map className="h-3.5 w-3.5" /> LEVEL {runtime.questionIndex + 1}
            </button>
            {testMode && classId ? (
              <button
                type="button"
                onClick={() => setArrangeOpen(true)}
                title="Arrange Levels"
                className="inline-flex items-center gap-1.5 rounded border border-border/60 px-2 py-1 text-xs hover:bg-accent"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
            ) : null}
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
              setMapOpen(true);
            }}
            className="block w-full border-b border-border/60 px-3 py-2.5 text-left"
          >
            Your journey
          </button>
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

      {mapOpen ? (
        <GameLevelMap
          nodes={levelNodes}
          currentIndex={runtime.questionIndex}
          style={assignment?.levelMapStyle ?? "path"}
          onOpen={(index) => {
            runtime.goToQuestion(index);
            setMapOpen(false);
          }}
          onClose={() => setMapOpen(false)}
        />
      ) : null}

      {arrangeOpen && classId && gameId ? (
        <LevelArrangeDialog
          gameId={gameId}
          classId={classId}
          assignment={assignment}
          onClose={() => setArrangeOpen(false)}
          onSaved={() => setBoardsEpoch((n) => n + 1)}
        />
      ) : null}

      {/* GAME EVALUATION — the teacher's live inspector for the active line. */}
      {testMode ? (
        <GameEvaluationPanel
          open={evalOpen}
          onToggle={() => setEvalOpen((open) => !open)}
          report={lineReport}
          resources={{
            questionDeadline: runtime.questionDeadline,
            lineDeadline: runtime.lineDeadline,
            lives: runtime.lives,
            vaultsOpened: runtime.vaultsOpened,
            vaultsTotal: runtime.vaultsTotal,
            vaultReward: runtime.vaultReward,
            completionCount: runtime.completionCount,
            currentLine: runtime.currentLine,
            completedLines: runtime.completedLines.length,
            totalLines: Math.max(0, runtime.lines.length - 1),
            earnedMarks: runtime.earnedMarks,
            totalMarks: runtime.totalMarks,
          }}
          events={events}
        />
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
