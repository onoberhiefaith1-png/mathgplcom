// IMAGINE PLAY — the Game rules on a fast 2D Smartboard-style stage.
//
// Imagine shares the established Game data and assignment rules, but owns a
// separate 2D editor, player route and renderer.
//
// Two existing systems are placed together without reimplementing mathematics:
//   • a DOM writing stage over the chosen image/video background
//   • Smartboard's Floating Numbers control panel (PresentationView with
//     chrome="game") for input, marking and timing
//
// Reward animation remains in a bounded pointer-free overlay and never gates
// input, grading, progression or scrolling.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tableCellConfigOf, tableSurfaceLines } from "@/lib/slate/tableSurface";
import { clampGameTableScale, gameTableNaturalSize } from "@/lib/slate/gameTableScale";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, ListOrdered, Map, RotateCcw, Type, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearBoardMirrors } from "@/hooks/useAssessmentBoardSession";
import { loadGame, saveGameResult } from "@/lib/slate/storage";
import { fitTextToWritingSurface } from "@/lib/slate/restoreText";
import { IMAGINE_TEXT_RANGE, imagineSavedSize, imagineSizeToSlider, imagineSliderToSize } from "@/lib/imagine/responsiveSize";
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
import ImagineStage from "@/components/imagine/ImagineStage";
import PresentationView from "@/components/smartboard/PresentationView";
import { getReward, rewardMayFire } from "@/lib/slate/rewards";
import { GameLoadingScreen } from "@/components/gameslate/GameLoadingScreen";
import { GAME_STARTUP_DEADLINE_MS } from "@/lib/game/runtime/startup";
import { GameEvaluationPanel } from "@/components/gameslate/GameEvaluationPanel";
import GameLevelMap, { type LevelMapNode } from "@/components/gameslate/GameLevelMap";
import LevelArrangeDialog from "@/components/gameslate/LevelArrangeDialog";
import SelectClassDialog from "@/components/gameslate/SelectClassDialog";
import { predict, provesEquivalent, routeMapFor } from "@/lib/predictive/predictiveLine";
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
import type { SlotTextConfig } from "@/lib/slate/textConfig";
import { sameTextConfig } from "@/lib/slate/textConfig";
import { loadStudentContentMargin, saveStudentContentMargin } from "@/lib/slate/studentMargin";
import type { GameMathLine } from "@/lib/slate/structuredMath";
import { latexToTree } from "@/lib/smartboard/mathTreeLatex";
import { rowToAscii } from "@/lib/smartboard/rowAscii";
import type { GuestGamePayload } from "@/lib/guests/guestApi";
import { primeAssetUrl } from "@/lib/slate/assets";
import QuestionVideoPane, { type LineContext } from "@/components/smartboard/QuestionVideoPane";
import { loadActivity, type AcademiaActivity } from "@/lib/academia/api";
import { activityHref, activityNeighbours } from "@/lib/academia/activityChain";
import { videoReady, type QuestionVideoConfig } from "@/lib/courses/questionVideo";
import { isMuted, setMuted } from "@/lib/slate/audio";
import { playMove, setMoveVolume } from "@/lib/imagine/moveSounds";
import { setBackgroundVolume } from "@/lib/slate/gameSound";
import { normalizeImagineGame, normalizeImagineReward } from "@/lib/imagine/rewards";
import { GameCompletionScene } from "@/components/imagine/GameCompletionScene";
import { useAccount } from "@/lib/accounts/useAccount";


const ImaginePlayPage = ({ guest = null, offline = null }: {
  /** Guest Link sitting: the payload already fetched by the public link. */
  guest?: { code: string; token: string; name: string | null; payload: GuestGamePayload; playVideo?: QuestionVideoConfig | null } | null;
  /** Installed Academia sitting: the exact saved Game, with local marking and
   * no account, class or network dependency. */
  offline?: {
    activityId: string;
    game: Game;
    board: GameQuestionBoard;
    startingLives: number;
    assetUrls: Record<string, string>;
    playVideo?: QuestionVideoConfig | null;
    onLineAward?: (award: { lineId: string; studentAscii: string; marks: number }) => void;
    onExit: () => void;
  } | null;
} = {}) => {
  const params = useParams<{ gameId: string }>();
  const gameId = offline?.game.id ?? (guest ? guest.payload.game.id : params.gameId);
  const [searchParams] = useSearchParams();
  // Guest links and Autoplay carry the instance they mean.
  const requestedClassId = searchParams.get("classId");
  // Academia: ONE card is ONE question. Play opens that Class + Game instance
  // directly — no class picker and no teacher inspector.
  const academiaActivity = searchParams.get("academia");
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
  const ownerRef = useRef(false);
  const textRepairTimer = useRef<number | null>(null);
  const marginTimer = useRef<number | null>(null);
  const worldReadyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  /** Live working per Floating Numbers line (0-based) → plain text. */
  const [lineText, setLineText] = useState<Record<number, string>>({});
  /** The same working for the writing surfaces, carrying the sensor mark and
   *  the placeholder box of any empty bracket / fraction / exponent slot. */
  const [displayLineText, setDisplayLineText] = useState<Record<number, string>>({});
  /** Structure-preserving display mirror; never used for grading or Vaults. */
  const [structuredLineMath, setStructuredLineMath] = useState<Record<number, GameMathLine>>({});
  const pendingLineText = useRef<Record<number, string> | null>(null);
  const pendingDisplayText = useRef<Record<number, string> | null>(null);
  const pendingStructuredMath = useRef<Record<number, GameMathLine> | null>(null);
  const lineTextFrame = useRef<number | null>(null);
  const displayTextFrame = useRef<number | null>(null);
  const structuredMathFrame = useRef<number | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const [textFitEpoch, setTextFitEpoch] = useState(0);
  /** TEXT SIZE. The player's own reading size for the writing on the surfaces:
   *  left is smaller, right is bigger. Never changes the teacher's design. */
  const [playerTextSize, setPlayerTextSize] = useState<number | null>(null);
  /** TEXT COLOUR. null = the surface's own ink. */
  const [textColour, setTextColour] = useState<string | null>(null);
  const [muted, setMutedState] = useState(() => isMuted());
  const [soundVolume, setSoundVolume] = useState(1);
  const [leavingEarly, setLeavingEarly] = useState(false);

  const [resetting, setResetting] = useState(false);
  /** Phone only: Exit and Reset live in a small menu so the strip stays short. */
  const [menuOpen, setMenuOpen] = useState(false);
  const playViewport = useBreakpoint();
  const phone = playViewport === "phone";
  const savedPlayTextSize = useMemo(() => {
    if (!game) return IMAGINE_TEXT_RANGE[playViewport].midpoint;
    const t = game.settings.text;
    const fallback = playViewport === "desktop" ? t.desktopSize : playViewport === "tablet" ? t.tabletSize : t.mobileSize;
    return imagineSavedSize(game.settings.imagine, playViewport, fallback ?? t.size);
  }, [game, playViewport]);
  const [playVideo, setPlayVideo] = useState<QuestionVideoConfig | null>(offline?.playVideo ?? guest?.playVideo ?? null);
  const [videoOpen, setVideoOpen] = useState(true);
  const [videoLineContext, setVideoLineContext] = useState<LineContext>({ questionId: null, lineId: null, index: 0, total: 0, completed: false });

  useEffect(() => {
    if (offline?.playVideo !== undefined) { setPlayVideo(offline.playVideo ?? null); return; }
    if (guest?.playVideo !== undefined) { setPlayVideo(guest.playVideo ?? null); return; }
    if (!academiaActivity) { setPlayVideo(null); return; }
    let cancelled = false;
    void loadActivity(academiaActivity).then((activity) => {
      if (!cancelled) setPlayVideo(activity?.play_video ?? null);
    }).catch(() => { if (!cancelled) setPlayVideo(null); });
    return () => { cancelled = true; };
  }, [academiaActivity, guest?.playVideo, offline?.playVideo]);

  /* ---- GAME EVALUATION (teacher Play / Test only) ---------------------
   * A pure observer: it reads the Game's own state and the verdicts the board
   * already publishes. It never grades, never selects a line, never writes. */
  const [evalOpen, setEvalOpen] = useState(false);
  // Evaluation is a teacher tool: teachers, school owners and platform staff
  // see it (role read from the signed-in account); students never do.
  const account = useAccount();
  const canEvaluate = !guest && (testMode || ["teacher", "school", "platform_owner", "co_admin"].includes(account.role ?? "") || account.isPlatformOwner);
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
        // The saved Game is present. Expose its core stage now; optional visual
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
  const mirrorStructuredMath = (next: Record<number, GameMathLine>) => {
    pendingStructuredMath.current = next;
    if (structuredMathFrame.current !== null) return;
    structuredMathFrame.current = window.requestAnimationFrame(() => {
      structuredMathFrame.current = null;
      const latest = pendingStructuredMath.current;
      pendingStructuredMath.current = null;
      if (latest) setStructuredLineMath(latest);
    });
  };
  useEffect(() => () => {
    if (lineTextFrame.current !== null) window.cancelAnimationFrame(lineTextFrame.current);
    if (displayTextFrame.current !== null) window.cancelAnimationFrame(displayTextFrame.current);
    if (structuredMathFrame.current !== null) window.cancelAnimationFrame(structuredMathFrame.current);
    if (textRepairTimer.current !== null) window.clearTimeout(textRepairTimer.current);
    if (marginTimer.current !== null) window.clearTimeout(marginTimer.current);
  }, []);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    if (offline) {
      ownerRef.current = false;
      Object.entries(offline.assetUrls).forEach(([id, url]) => primeAssetUrl(id, url));
      setUid(`offline:${offline.activityId}`);
      setGame(normalizeImagineGame(offline.game));
      setClassId(null);
      setAssignment(null);
      setAssignmentId(null);
      setTestMode(true);
      setBoards([offline.board]);
      setLoading(false);
      return;
    }
    if (guest) {
      // Guest Link: no account. Nothing is written to class or student records;
      // marks go to the guest's own attempt through the marking engine.
      ownerRef.current = false;
      Object.entries(guest.payload.assetUrls ?? {}).forEach(([id, url]) => primeAssetUrl(id, url));
      setUid(guest.token);
      setGame(normalizeImagineGame(guest.payload.game));
      setClassId(guest.payload.classId);
      setAssignment(guest.payload.assignment);
      setAssignmentId(null);
      setTestMode(true);
      setBoards(guest.payload.boards);
      setLoading(false);
      return;
    }
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
      ownerRef.current = isOwner;
      if (cancelled) return;
      if (!loaded || !userId) {
        setError("This Game is not available.");
        setLoading(false);
        return;
      }
      setUid(userId);
      setGame(normalizeImagineGame(loaded));

      // A student's own margin, when they have moved it before.
      if (!isOwner) {
        const own = await loadStudentContentMargin(gameId, userId);
        if (!cancelled && own !== null) {
          setGame((current) =>
            current ? { ...current, settings: { ...current.settings, contentMargin: own } } : current,
          );
        }
      }


      try {
        if (academiaActivity && requestedClassId) {
          // The Academia card names its own instance. Compile it when the
          // teacher opens it, otherwise read what is already prepared.
          const byClass = await loadGameAssignmentState(gameId);
          const own = byClass.get(requestedClassId) ?? null;
          const [all, card] = await Promise.all([
            isOwner
              ? ensureGameBoards({ gameId, classId: requestedClassId })
              : loadGameBoards({ gameId, classId: requestedClassId }),
            loadActivity(academiaActivity).catch(() => null),
          ]);
          if (cancelled) return;
          // Academia: one card = one question. No Levels — only this question.
          const wanted = card?.subsection_id ?? null;
          const built = wanted ? all.filter((b) => b.subsectionId === wanted) : all.slice(0, 1);
          setClassChoices([]);
          setTestMode(false);
          setClassId(requestedClassId);
          setAssignment(own);
          setAssignmentId(isOwner ? null : own?.id ?? null);
          setBoards(built);
          if (built.length === 0) {
            setError("This question is not ready in the Game yet. Ask the teacher to assign it again.");
          }
        } else if (isOwner) {
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
  }, [gameId, chosenClassId, requestedClassId, academiaActivity, boardsEpoch, offline]);

  const runtime = useGameRuntime({
    game, boards, studentId: uid, assignmentId, testMode,
    // the Vault compares the student's own working against the wanted method
    lineText,
    startingLives: offline?.startingLives ?? assignment?.startingLives ?? 3,
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
  useEffect(() => {
    setLineText({});
    setDisplayLineText({});
    setStructuredLineMath({});
  }, [runtime.question?.questionRowId]);

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
    }, 2400);
    return () => window.clearTimeout(handle);
  }, [runtime.consumedRewardKeys, runtime.completedLines]);


  /* ---- a sound for every move (fire-and-forget, never blocks) -------- */
  useEffect(() => { setMoveVolume(soundVolume); }, [soundVolume]);
  const prevTextLen = useRef(0);
  useEffect(() => {
    const len = Object.values(lineText).reduce((n, s) => n + (s?.length ?? 0), 0);
    if (len > prevTextLen.current) playMove("type");
    else if (len < prevTextLen.current) playMove("erase");
    prevTextLen.current = len;
  }, [lineText]);
  const prevLine = useRef<number | null>(null);
  useEffect(() => {
    if (prevLine.current !== null && prevLine.current !== runtime.currentLine) playMove("step");
    prevLine.current = runtime.currentLine;
  }, [runtime.currentLine]);
  const prevDone = useRef<number | null>(null);
  const streak = useRef(0);
  useEffect(() => {
    const n = runtime.completedLines.length;
    if (prevDone.current !== null && n > prevDone.current) { streak.current += 1; playMove("correct", streak.current); }
    prevDone.current = n;
  }, [runtime.completedLines]);
  const prevVerdicts = useRef<Record<string, number>>({});
  useEffect(() => {
    for (const v of Object.values(verdicts)) {
      if (prevVerdicts.current[v.lineId] === v.at) continue;
      prevVerdicts.current[v.lineId] = v.at;
      if (!v.correct) { streak.current = 0; playMove("wrong"); }
    }
  }, [verdicts]);
  const prevQs = useRef<number | null>(null);
  useEffect(() => {
    const n = runtime.completedQuestionIds.length;
    if (prevQs.current !== null && n > prevQs.current) playMove("complete");
    prevQs.current = n;
  }, [runtime.completedQuestionIds]);
  /* ---- arrow keys move the sensor between lines 1+ ------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
      e.preventDefault();
      setActiveLine(runtime.currentLine + (e.key === "ArrowDown" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---- table writing surfaces (shared with the original Game) ---- */
  const [gameTableScales, setGameTableScales] = useState<Record<string, number>>({});
  const [gameTableHeights, setGameTableHeights] = useState<Record<string, number>>({});
  const tableLines = useMemo(() => {
    const rows = runtime.question?.boardSource.reservoirs[0]?.lines ?? [];
    return tableSurfaceLines(rows.map((l) => l.table?.objId ?? null));
  }, [runtime.question]);
  const gameTableSurfaces = useMemo(() => {
    const out: Record<string, { surfaceId: string; surfaceColour?: string }> = {};
    if (!game) return out;
    for (const row of runtime.lines) {
      const tableId = tableLines.anchors.get(row.line);
      if (!tableId) continue;
      const rendered = resolveRenderedLineSlot(game, { ...row, text: "", rewards: [] });
      out[tableId] = {
        surfaceId: rendered.surfaceId ?? game.surfaceId,
        ...(game.surfaceColour ? { surfaceColour: game.surfaceColour } : {}),
      };
    }
    return out;
  }, [game, runtime.lines, tableLines.anchors]);
  const subcellStoreKey = runtime.question && uid
    ? `game-subcells:${uid}:${gameId}:${runtime.question.questionRowId}`
    : null;
  const [paidSubcells, setPaidSubcells] = useState<string[]>([]);
  useEffect(() => {
    if (!subcellStoreKey) { setPaidSubcells([]); return; }
    try { setPaidSubcells(JSON.parse(window.localStorage.getItem(subcellStoreKey) ?? "[]") ?? []); }
    catch { setPaidSubcells([]); }
  }, [subcellStoreKey, resetEpoch]);
  const awardSubcellNow = runtime.awardSubcell;
  const paySubcell = useCallback((objId: string, key: string) => {
    const id = `${objId}:${key}`;
    setPaidSubcells((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      if (subcellStoreKey) window.localStorage.setItem(subcellStoreKey, JSON.stringify(next));
      const cfg = tableCellConfigOf(gameRef.current?.settings.tables?.[objId]?.[key]);
      awardSubcellNow(objId, key, cfg.marks, cfg.coin);
      return next;
    });
  }, [subcellStoreKey, awardSubcellNow]);

  /** The physical slate for THIS question: Line 0 plus one Line per solving line. */
  const displayGame = useMemo<Game | null>(() => {
    if (!game || runtime.lines.length === 0 || !runtime.question) return game;
    const patternLength = patternLengthOf(game);
    const question = runtime.question;
    const slots: Slot[] = runtime.lines.filter((row) => !tableLines.hidden.has(row.line)).map((row) => {
      const tableId = tableLines.anchors.get(row.line);
      if (tableId) {
        const grid = question.boardSource.reservoirs[0]?.lines[row.line - 1]?.table?.grid;
        const naturalSize = gameTableNaturalSize(grid);
        const rendered = resolveRenderedLineSlot(game, { ...row, text: "", rewards: [] });
        return {
          ...rendered,
          gameTable: {
            objId: tableId,
            rows: Math.max(1, Number(grid?.rows) || 1),
            cols: Math.max(1, Number(grid?.cols) || 1),
            scale: clampGameTableScale(gameTableScales[tableId]),
            naturalWidthPx: naturalSize.width,
            naturalHeightPx: naturalSize.height,
            measuredHeightPx: gameTableHeights[tableId],
          },
        };
      }
      // Line 0 is the question, read-only and outside rewards and marks.
      // Every other Game Line carries the student's own live working, and its
      // teaching note only once the line has actually earned its marks.
      const working = row.isQuestion ? "" : floatingTextForGameLine(renderedLineText, row.line);
      const noteOnly = !row.isQuestion && row.line === 1 && question.lineNoteOnly[0] === true;
      const text = gameLineDisplayText({
        isQuestion: row.isQuestion,
        questionText: question.questionText,
        working,
        // Notes have their own structuredNote region below. Supplying the note
        // here too rendered the same first-line word twice.
        note: null,
        awarded: false,
        noteOnly: false,
      });
      const rewards: RewardInstance[] = row.rewards.map((sourceReward) => {
          const reward = normalizeImagineReward(sourceReward);
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
      const rendered = resolveRenderedLineSlot(game, { ...row, text, rewards });
      const structuredMath: GameMathLine | undefined = row.isQuestion
        ? { rows: [{ sourceRow: 0, row: latexToTree(question.questionText), cursor: null }] }
        : structuredLineMath[row.line - 1];
      const note = !row.isQuestion && (noteOnly || runtime.completedLines.includes(row.line))
        ? question.lineNotes[row.line - 1] ?? undefined
        : undefined;
      return {
        ...rendered,
        ...(structuredMath?.rows.length ? { structuredMath } : {}),
        ...(note ? { structuredNote: note } : {}),
      };
    });
    const renderedGame = { ...game, slots, patternLength };
    const fitted = textFitEpoch > 0 ? fitTextToWritingSurface(renderedGame) : renderedGame;
    // Game text size: the creator's saved device size is the starting size;
    // the player's slider replaces it directly (same range, no multiplier).
    if (playerTextSize == null) return fitted;
    const key = playViewport === "desktop" ? "desktopTextSize" : playViewport === "tablet" ? "tabletTextSize" : "mobileTextSize";
    return { ...fitted, settings: { ...fitted.settings, imagine: { ...fitted.settings.imagine, [key]: playerTextSize } } } as typeof fitted;

  }, [
    game,
    runtime.lines,
    runtime.question,
    runtime.consumedRewardKeys,
    runtime.completedLines,
    runtime.timedLine,
    renderedLineText,
    structuredLineMath,
    celebrating,
    textFitEpoch,
    playerTextSize,
    playViewport,
    tableLines,
    gameTableScales,
    gameTableHeights,
  ]);


  // Academia Play chain: each activity is one question; Continue on its
  // completion screen opens the next activity's Play in the Session.
  const [nextPlay, setNextPlay] = useState<AcademiaActivity | null>(null);
  useEffect(() => {
    if (!academiaActivity || guest) { setNextPlay(null); return; }
    let alive = true;
    void activityNeighbours(academiaActivity, "play").then((n) => { if (alive) setNextPlay(n.next); }).catch(() => undefined);
    return () => { alive = false; };
  }, [academiaActivity, guest]);
  const continueToNextPlay = async () => {
    if (!nextPlay) return leaveGameNow();
    const href = await activityHref(nextPlay, "play").catch(() => null);
    if (href) { window.location.replace(href); return; }
    leaveGameNow();
  };

  /** Leaving the Game always works, even when it was opened from a link. */
  const leaveGameNow = () => {
    setMenuOpen(false);
    if (offline) { offline.onExit(); return; }
    // From Academia, leaving goes back to the question card and replaces the
    // Game in history, so that card's Back reaches the Session (no loop).
    if (academiaActivity) { navigate(`/academia/activity/${academiaActivity}`, { replace: true }); return; }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(classId ? `/student/class/${classId}` : "/");
  };
  const exitGame = () => {
    setMenuOpen(false);
    if (runtime.status === "in_progress" && !runtime.completion) {
      setLeavingEarly(true);
      return;
    }
    leaveGameNow();
  };


  /**
   * THE CONTENT MARGIN. Moving the handle moves where the writing begins. The
   * teacher's move is saved on the Game; a student's move is saved as that
   * student's own preference and never touches the teacher's design.
   */
  const changeContentMargin = (contentMargin: number) => {
    setGame((current) =>
      current ? { ...current, settings: { ...current.settings, contentMargin } } : current,
    );
    if (!gameId) return;
    if (ownerRef.current) {
      if (marginTimer.current !== null) window.clearTimeout(marginTimer.current);
      marginTimer.current = window.setTimeout(() => {
        setGame((current) => {
          if (current) void saveGameResult(current);
          return current;
        });
      }, 600);
      return;
    }
    if (!uid) return;
    if (marginTimer.current !== null) window.clearTimeout(marginTimer.current);
    marginTimer.current = window.setTimeout(() => {
      void saveStudentContentMargin(gameId, uid, contentMargin);
    }, 600);
  };


  /**
   * Play validates the exact same saved pattern record as Edit. Only an
   * authenticated owner may persist an automatic repair; student rendering is
   * contained locally and can never alter a teacher's design.
   */
  const persistPlayTextCorrection = (runtimeSlotId: string, textConfig: SlotTextConfig) => {
    if (!ownerRef.current) return;
    const line = gameLineFromSlotId(runtimeSlotId);
    if (line === null) return;
    setGame((current) => {
      if (!current) return current;
      const patternLength = patternLengthOf(current);
      const patternIndex = line === 0 ? 0 : Math.max(0, (line - 1) % patternLength);
      const slot = current.slots[patternIndex];
      if (!slot || (slot.textConfig && sameTextConfig(slot.textConfig, textConfig))) return current;
      const repaired = {
        ...current,
        slots: current.slots.map((item, index) => index === patternIndex ? { ...item, textConfig } : item),
      };
      if (textRepairTimer.current !== null) window.clearTimeout(textRepairTimer.current);
      textRepairTimer.current = window.setTimeout(() => void saveGameResult(repaired), 500);
      return repaired;
    });
  };

  /* ---- Game Evaluation observers -------------------------------------- */
  // The expected line is the teacher's own answer key. It is read only in the
  // owner's Play / Test sitting, where the row's owner-only policy applies.
  const assessmentId = runtime.question?.assessmentId ?? null;
  useEffect(() => {
    if (!canEvaluate || !assessmentId) { setExpectedLines({}); setExpectedAtoms({}); return; }
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
  }, [canEvaluate, assessmentId]);

  // Verdicts: the board already publishes every check on its in-page live feed.
  // Listening changes nothing about grading — it only mirrors what happened.
  useEffect(() => {
    if (!canEvaluate || !assessmentId || !uid) return;
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
  }, [canEvaluate, assessmentId, uid]);

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
    const plainStudentAscii = row.isQuestion
      ? question.questionText
      : floatingTextForGameLine(lineText, row.line);
    const boardStudentAscii = row.isQuestion
      ? question.questionText
      : (structuredLineMath[row.line - 1]?.rows ?? [])
          .map((entry) => rowToAscii(entry.row))
          .filter(Boolean)
          .join(" ")
          .trim();
    const evidence = [plainStudentAscii, boardStudentAscii].filter((value, index, all) =>
      value.trim().length > 0 && all.indexOf(value) === index,
    );
    const studentAscii = !row.isQuestion && expectedAscii
      ? evidence.find((value) => provesEquivalent(expectedAscii, value)) ?? evidence[0] ?? ""
      : evidence[0] ?? "";
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
    verdicts, conversion, structuredLineMath,
  ]);

  // INSTANT AWARD: the moment evaluation proves this line equivalent, pay it —
  // mark, coin, rewards, note. No need to move to the next line. The runtime
  // pays each line once, so a later board confirmation is a no-op.
  const onLineAwardNow = runtime.onLineAward;
  useEffect(() => {
    const question = runtime.question;
    if (!question || !lineReport || lineReport.isQuestion) return;
    if (lineReport.status !== "equivalent") return;
    if (runtime.completedLines.includes(lineReport.line)) return;
    const row = runtime.lines.find((l) => l.line === lineReport.line);
    const lineId = row?.lineId;
    const studentAscii = (lineReport.student ?? "").trim();
    if (!lineId || !studentAscii) return;
    onLineAwardNow({
      questionId: question.boardQuestionId,
      lineId,
      studentAscii,
      marks: question.lineMarks[lineReport.line - 1] ?? 0,
    });
  }, [lineReport, runtime.question, runtime.completedLines, runtime.lines, onLineAwardNow]);


  // Live activity. Every entry corresponds to a real change in Game state.
  const lastEventRef = useRef({ line: 0, status: "", vaults: -1, completion: -1, timed: -1 });
  useEffect(() => {
    if (!canEvaluate || !lineReport) return;
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
    canEvaluate, lineReport, runtime.vaultsOpened, runtime.vaultsTotal,
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
            Promise.resolve(clearBoardMirrors(board.assessmentId, uid)),
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
              Open Game Editor
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
      testMode={guest ? false : testMode}
      localMarking={!!offline}
      {...(guest ? { guestSlug: guest.code, participantKey: guest.token, guestName: guest.name } : {})}
      onLineContext={(context) => {
        runtime.onLineContext(context);
        if (videoReady(playVideo)) setVideoLineContext(context);
      }}
      onLineAward={(award) => {
        runtime.onLineAward(award);
        offline?.onLineAward?.(award);
      }}
      // Only the Floating Numbers control panel is shown; the Game Slate is
      // the board, and Game Lines own line selection.
      chrome="game"
      activeLine={Math.max(0, runtime.currentLine - 1)}
      onActiveLineChange={(line) => setActiveLine(line)}
      onLineText={mirrorLineText}
      onLineDisplayText={mirrorDisplayText}
      onLineStructuredMath={mirrorStructuredMath}
      gameTableConfig={game?.settings.tables}
      gameSolvedSubcells={paidSubcells}
      onTableSubcellSolved={paySubcell}
      gameTableScales={gameTableScales}
      gameTableSurfaces={gameTableSurfaces}
      onGameTableScaleChange={(objId, scale) => setGameTableScales((current) => ({
        ...current,
        [objId]: clampGameTableScale(scale),
      }))}
      onGameTableHeightChange={(objId, height) => setGameTableHeights((current) => {
        if (Math.abs((current[objId] ?? 0) - height) < 2) return current;
        return { ...current, [objId]: height };
      })}
    />
  ) : null;

  // 100dvh, exactly like the Assignment board: the phone browser's own bottom
  // bar is excluded from the stage, so the Floating Numbers strip always ends
  // above it instead of hiding behind it.
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      {/* THE BOARD. The Game Slate world is the whole screen. */}
      <div className="absolute inset-0 z-0">
        {displayGame && (
          <ImagineStage
            game={displayGame}
            textColour={textColour}
            textSizeViewport={playViewport}
            mode="view"
            selection={surfaceSelection}
            onSelect={(selection) => {
              if (selection.kind !== "slot") return;
              const line = gameLineFromSlotId(selection.slotId);
              if (line === null) return;
              setActiveLine(line, true);
            }}
            onSlotChange={() => {}}
            onTextConfigCorrection={persistPlayTextCorrection}
            onContentMarginChange={changeContentMargin}
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
            restoreKey={textFitEpoch}
            onReadyChange={setWorldReady}
            onProgressChange={setLoadingProgress}
          />
        )}
      </div>
      {!worldReady ? <GameLoadingScreen className="fixed" progress={loadingProgress} /> : null}
      {videoReady(playVideo) && playVideo && runtime.question && (
        <aside className={`${videoOpen ? "block" : "hidden"} absolute bottom-16 right-2 top-12 z-30 w-[min(42vw,620px)] overflow-hidden rounded-lg border border-border bg-background shadow-xl max-md:bottom-20 max-md:left-2 max-md:w-auto`}>
          <QuestionVideoPane
            config={playVideo}
            lines={runtime.question.lineIds.map((lineId, index) => ({ lineId, label: `Line ${index + 1}`, preview: runtime.question?.lineNotes[index] ?? null, note: runtime.question?.lineNotes[index] ?? null }))}
            lineContext={videoLineContext}
            className="h-full"
          />
        </aside>
      )}
      {videoReady(playVideo) && (
        <button type="button" className="absolute right-3 top-12 z-40 rounded-md border border-border bg-background px-3 py-1.5 text-xs shadow" onClick={() => setVideoOpen((value) => !value)}>
          {videoOpen ? "Hide video" : "Show video"}
        </button>
      )}

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
            {runtime.questionEarnedMarks}/{runtime.questionTotalMarks}
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
            onClick={exitGame}

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
              {runtime.questionEarnedMarks} / {runtime.questionTotalMarks}
              {runtime.questionTotalMarks > 0
                ? ` · ${Math.round((runtime.questionEarnedMarks / runtime.questionTotalMarks) * 100)}%`
                : ""}
            </span>
            {!academiaActivity ? (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              title="Your journey"
              className="inline-flex items-center gap-1.5 rounded border border-border/60 px-2.5 py-1 text-xs font-semibold tracking-wide hover:bg-accent"
            >
              <Map className="h-3.5 w-3.5" /> LEVEL {runtime.questionIndex + 1}
            </button>
            ) : null}
            {testMode && classId && !academiaActivity ? (
              <button
                type="button"
                onClick={() => setArrangeOpen(true)}
                title="Arrange Levels"
                className="inline-flex items-center gap-1.5 rounded border border-border/60 px-2 py-1 text-xs hover:bg-accent"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <label
              className="inline-flex items-center gap-1.5 rounded border border-border/60 px-2.5 py-1 text-xs font-semibold tracking-wide"
              title="Text size: left is smaller, right is bigger"
            >
              <Type className="h-3.5 w-3.5" /> TEXT SIZE
              <input
                type="range"
min={0}
                max={100}
                step={0.5}
                value={imagineSizeToSlider(playerTextSize ?? savedPlayTextSize, playViewport)}
                onChange={(event) => setPlayerTextSize(imagineSliderToSize(Number(event.target.value), playViewport))}
                aria-label="Text size"
                className="h-1 w-24 cursor-pointer accent-primary"
              />
            </label>
            <button type="button" onClick={() => { const next = !muted; setMutedState(next); setMuted(next); setBackgroundVolume(next ? 0 : (game.settings.sound.background.volume * soundVolume)); }} title={muted ? "Turn sound on" : "Turn sound off"} className="inline-flex items-center gap-1.5 rounded border border-border/60 px-2.5 py-1 text-xs font-semibold tracking-wide hover:bg-accent">{muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />} SOUND</button>
            <input type="range" min={0} max={1} step={0.05} value={soundVolume} onChange={(event) => { const volume = Number(event.target.value); setSoundVolume(volume); if (!muted) setBackgroundVolume(game.settings.sound.background.volume * volume); }} aria-label="Sound volume" className="h-1 w-20 cursor-pointer accent-primary" />

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
          <div className="border-b border-border/60 px-3 py-2.5">
            <div className="mb-1 text-xs text-muted-foreground">Text size</div>
            <input
              type="range"
min={0}
                max={100}
                step={0.5}
                value={imagineSizeToSlider(playerTextSize ?? savedPlayTextSize, playViewport)}
                onChange={(event) => setPlayerTextSize(imagineSliderToSize(Number(event.target.value), playViewport))}
              aria-label="Text size"
              className="h-1 w-full cursor-pointer accent-primary"
            />
          </div>
          <div className="border-b border-border/60 px-3 py-2.5">
            <div className="mb-1.5 text-xs text-muted-foreground">Text colour</div>
            <div className="flex flex-wrap gap-1.5">
              {[null, "#1f1a14", "#ffffff", "#1e4fa3", "#b3261e", "#1d7a3a", "#7a3fb0"].map((c) => (
                <button
                  key={c ?? "auto"}
                  type="button"
                  aria-label={c ? `Text colour ${c}` : "Surface ink"}
                  onClick={() => setTextColour(c)}
                  className={`h-6 w-6 rounded-full border text-[9px] font-bold ${textColour === c ? "ring-2 ring-primary ring-offset-1" : "border-border"}`}
                  style={c ? { background: c } : undefined}
                >{c ? "" : "A"}</button>
              ))}
            </div>
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
            onClick={exitGame}
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
      {canEvaluate ? (
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
            earnedMarks: runtime.questionEarnedMarks,
            totalMarks: runtime.questionTotalMarks,
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
      {runtime.completion ? (
        <GameCompletionScene
          game={game}
          summary={runtime.completion.summary}
          final={runtime.completion.final && !nextPlay}
          failed={runtime.completion.failed}
          questionNumber={runtime.questionIndex + 1}
          questionTotal={boards.length}
          onContinue={() => runtime.completion?.final ? (nextPlay ? void continueToNextPlay() : leaveGameNow()) : runtime.continueCompletion()}
          onRetry={() => runtime.restartQuestion()}
          onExit={leaveGameNow}
        />
      ) : leavingEarly ? (
        <GameCompletionScene
          game={game}
          summary={{ marks: 0, totalMarks: runtime.question?.totalMarks ?? 0, completionCoins: 0, vaultReward: 0, vaultsOpened: 0, timeEarnedSeconds: 0, livesDelta: 0 }}
          final={false}
          left
          questionNumber={runtime.questionIndex + 1}
          questionTotal={boards.length}
          onExit={leaveGameNow}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 z-10">{controls}</div>
      )}
    </div>
  );
};

export default ImaginePlayPage;
