// Game Play runtime.
//
// It owns ONLY the game world's own state: which question and Line the student
// is on, coins, lives, timers and which physical rewards have been consumed.
// Mathematics, marking and the board itself stay entirely inside the existing
// Floating Numbers / Smartboard engine — this hook never grades anything.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapQuestionLines, type MappedLine } from "@/lib/slate/pattern";
import { lifeSeconds, vaultMatches } from "@/lib/slate/lineSurfaces";
import { convertUnitsToLives, normalizeConversion } from "@/lib/slate/conversion";
import type { Game } from "@/lib/slate/types";
import type { GameQuestionBoard } from "@/lib/slate/gameBoard";
import { saveGameQuestionResult } from "@/lib/slate/gameAssignments";
import { subscribeGameClock } from "@/lib/game/runtime/clock";

export interface LineContext {
  questionId: string | null;
  lineId: string | null;
  index: number;
  total: number;
  completed: boolean;
  lastAwardedLineId?: string | null;
  /** Exact working that received that authoritative award. */
  lastAwardedExpression?: string | null;
  lineEngaged?: boolean;
}

export interface GameLineAward {
  /** Canonical board question identity. */
  questionId: string;
  lineId: string;
  /** Exact immutable input snapshot proved equivalent by the board. */
  studentAscii: string;
  marks: number;
}

export interface GameRuntime {
  ready: boolean;
  questionIndex: number;
  question: GameQuestionBoard | null;
  lines: MappedLine[];
  /** 1-based Game Line the student is working on. */
  currentLine: number;
  completedQuestionIds: string[];
  /** 1-based Game Lines whose mark has been awarded in this question. */
  completedLines: number[];
  consumedRewardKeys: string[];
  vaultReward: number;
  /** Vaults opened in this question, and how many it holds in total. */
  vaultsOpened: number;
  vaultsTotal: number;
  /** The Game Line whose own Hourglass is counting, if any. */
  timedLine: number | null;
  completionCount: number;
  lives: number;
  /** Epoch ms the question timer runs out, or null when there is no timer. */
  questionDeadline: number | null;
  lineDeadline: number | null
  status: "in_progress" | "complete" | "failed";
  earnedMarks: number;
  totalMarks: number;
  message: string | null;
  onLineContext: (ctx: LineContext) => void;
  /** Atomic proved-line handoff from the existing Smartboard engine. */
  onLineAward: (award: GameLineAward) => void;
  /** A Bomb or Collector physically reached this visible reward. */
  consumeWorldReward: (line: number, rewardId: string) => void;
  /** Game Lines own line navigation — a tapped Game Line calls this. */
  selectLine: (line: number) => void;
  goToQuestion: (index: number) => void;
  restartQuestion: () => void;
  restartGame: () => Promise<void>;
  dismissMessage: () => void;
}

const REWARD_LIVES: Record<string, number> = { "retry-heart": 1 };

const rewardKey = (questionId: string, line: number, rewardId: string) =>
  `${questionId}:${line}:${rewardId}`;

export const useGameRuntime = (params: {
  game: Game | null;
  boards: GameQuestionBoard[];
  studentId: string | null;
  assignmentId?: string | null;
  /** Teacher's Play / Test sitting — nothing is recorded. */
  testMode?: boolean;
  /** The student's live working per Floating Numbers line (0-based index). */
  lineText?: Record<number, string>;
}): GameRuntime => {
  const {
    game, boards, studentId, assignmentId = null, testMode = false, lineText = {},
  } = params;

  const [ready, setReady] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentLine, setCurrentLine] = useState(1);
  const [completedQuestionIds, setCompletedQuestionIds] = useState<string[]>([]);
  const [completedLines, setCompletedLines] = useState<number[]>([]);
  const [consumed, setConsumed] = useState<string[]>([]);
  const [vaultReward, setVaultReward] = useState(0);
  const [completionCount, setCompletionCount] = useState(0);
  const [completedLineKeys, setCompletedLineKeys] = useState<string[]>([]);
  const [lives, setLives] = useState(3);
  const [questionDeadline, setQuestionDeadline] = useState<number | null>(null);
  const [lineDeadline, setLineDeadline] = useState<number | null>(null);
  /** The Game Line whose own Hourglass is running, for the world to read. */
  const [runningLine, setRunningLine] = useState<number | null>(null);
  const [status, setStatus] = useState<"in_progress" | "complete" | "failed">("in_progress");
  const [earnedMarks, setEarnedMarks] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const rowId = useRef<string | null>(null);
  const awarded = useRef<Set<string>>(new Set());
  /** Which Game Line the running line timer belongs to. */
  const timedLine = useRef<number | null>(null);
  /** Game Lines whose own timer ran out: their Hourglass has dissolved. */
  const expiredLines = useRef<Set<number>>(new Set());
  /** Live working, read at award time without re-creating callbacks. */
  const workRef = useRef<Record<number, string>>({});
  workRef.current = lineText;

  const question = boards[questionIndex] ?? null;
  const totalMarks = useMemo(
    () => boards.reduce((sum, b) => sum + b.totalMarks, 0),
    [boards],
  );

  const lines = useMemo(
    () => (game && question ? mapQuestionLines(game, question.lineTimers, question.lineIds, question.lineVaults) : []),
    [game, question],
  );

  /* ---- restore ------------------------------------------------------- */
  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    (async () => {
      const startingLives = game.status?.lives ?? 3;
      if (testMode || !studentId) {
        if (!cancelled) {
          setLives(startingLives);
          setReady(true);
        }
        return;
      }
      let query = supabase
        .from("slate_game_progress")
        .select("id, question_index, current_line, completed_question_ids, completed_line_keys, consumed_reward_keys, coins, vault_reward, completion_count, lives, status")
        .eq("game_id", game.id)
        .eq("student_id", studentId);
      query = assignmentId
        ? query.eq("assignment_id", assignmentId)
        : query.is("assignment_id", null);
      const { data } = await query.maybeSingle();
      if (cancelled) return;
      const row = data as {
        id: string;
        question_index: number;
        current_line: number;
        completed_question_ids: string[] | null;
        consumed_reward_keys: string[] | null;
        coins: number;
        vault_reward: number;
        completion_count: number;
        completed_line_keys: string[] | null;
        lives: number;
        status: string;
      } | null;
      if (row) {
        rowId.current = row.id;
        setQuestionIndex(Math.min(row.question_index, Math.max(0, boards.length - 1)));
        setCurrentLine(Math.max(1, row.current_line));
        setCompletedQuestionIds(row.completed_question_ids ?? []);
        setConsumed(row.consumed_reward_keys ?? []);
        setVaultReward(row.vault_reward ?? row.coins ?? 0);
        setCompletionCount(row.completion_count ?? row.completed_line_keys?.length ?? 0);
        setCompletedLineKeys(row.completed_line_keys ?? []);
        awarded.current = new Set(row.completed_line_keys ?? []);
        setLives(row.lives);
        setStatus(row.status === "complete" ? "complete" : "in_progress");
      } else {
        setLives(startingLives);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [game, studentId, assignmentId, testMode, boards.length]);

  /* ---- persist ------------------------------------------------------- */
  useEffect(() => {
    if (!ready || testMode || !studentId || !game) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        const payload = {
          game_id: game.id,
          assignment_id: assignmentId,
          student_id: studentId,
          question_index: questionIndex,
          current_line: currentLine,
          completed_question_ids: completedQuestionIds,
          consumed_reward_keys: consumed,
          coins: vaultReward,
          vault_reward: vaultReward,
          completion_count: completionCount,
          completed_line_keys: completedLineKeys,
          lives,
          status,
        };
        if (rowId.current) {
          await supabase.from("slate_game_progress").update(payload as never).eq("id", rowId.current);
          return;
        }
        const { data } = await supabase
          .from("slate_game_progress")
          .insert(payload as never)
          .select("id")
          .maybeSingle();
        rowId.current = (data as { id?: string } | null)?.id ?? null;
      })();
    }, 600);
    return () => window.clearTimeout(handle);
  }, [
    ready, testMode, studentId, game, assignmentId, questionIndex, currentLine,
    completedQuestionIds, completedLineKeys, consumed, vaultReward, completionCount, lives, status,
  ]);

  /* ---- question timer ------------------------------------------------ */
  const startQuestionTimer = useCallback((seconds: number | null) => {
    setQuestionDeadline(seconds && seconds > 0 ? Date.now() + seconds * 1000 : null);
  }, []);

  useEffect(() => {
    if (!question) return;
    startQuestionTimer(question.questionTimerSeconds);
    setLineDeadline(null);
    timedLine.current = null;
    expiredLines.current = new Set();
  }, [question, startQuestionTimer]);

  /* ---- Reward Conversion ---------------------------------------------
   * TIME is the main resource. The Hourglass converts straight to Time; the
   * Vault/Bot and the Completion Coin convert to Life instantly; a Life only
   * becomes Time at the moment it is actually spent. Bomb and the Collectors
   * are activation-only and never convert.
   */
  const conversion = useMemo(
    () => normalizeConversion(game?.settings.conversion, game?.settings.life?.multiplier),
    [game],
  );
  /** Leftover fractions of a Life, so ten units at 0.1x give exactly one Life. */
  const pendingVaultLife = useRef(0);
  const pendingCompletionLife = useRef(0);

  const convertVaultToLife = useCallback((units: number) => {
    const out = convertUnitsToLives(pendingVaultLife.current, units, conversion.vaultToLife);
    pendingVaultLife.current = out.pending;
    if (out.lives) setLives((prev) => prev + out.lives);
  }, [conversion]);

  const convertCompletionToLife = useCallback((units: number) => {
    const out = convertUnitsToLives(
      pendingCompletionLife.current, units, conversion.completionToLife,
    );
    pendingCompletionLife.current = out.pending;
    if (out.lives) setLives((prev) => prev + out.lives);
  }, [conversion]);

  /** A Life gives back the teacher-set multiple of the total Game/question time. */
  const lifeTimeSeconds = useCallback(
    () =>
      lifeSeconds(
        question?.questionTimerSeconds ?? null,
        conversion.lifeToTime,
      ),
    [question, conversion],
  );

  useEffect(() => {
    if (!questionDeadline) return;
    let done = false;
    const stop = subscribeGameClock((now) => {
      if (done || now < questionDeadline) return;
      done = true;
      setQuestionDeadline(null);
      setLives((prev) => {
        const next = prev - 1;
        if (next < 0) {
          setStatus("failed");
          setMessage("Time ran out and no lives were left — the Game restarts.");
          setQuestionIndex(0);
          setCurrentLine(1);
          return 0;
        }
        // completed lines stay completed; the life buys more time, nothing else
        const seconds = lifeTimeSeconds();
        setMessage(
          seconds
            ? `Time ran out — one life used, ${Math.round(seconds / 60) || 1} more minute(s) of question time.`
            : "Time ran out — one life used.",
        );
        startQuestionTimer(seconds || null);
        return next;
      });
    });
    return stop;
  }, [questionDeadline, lifeTimeSeconds, startQuestionTimer]);

  /* ---- Vault: the ONE way a Vault may ever pay ------------------------
   * A Vault is a reward attached to a line, opened by the teacher's exact
   * ordered sequence. Opening it may only record its own consumed key and add
   * its own reward value. It must NEVER write completed lines, completed line
   * keys, completion count, earned marks, or a saved question result — the
   * mathematical mark belongs solely to the authoritative awarded-line path.
   */
  const openVaultOnly = useCallback((key: string, value: number) => {
    setConsumed((prev) => (prev.includes(key) ? prev : [...prev, key]));
    const units = Math.max(0, value);
    setVaultReward((prev) => prev + units);
    // Vault/Bot -> Life: automatic and instant, never a mathematical mark.
    convertVaultToLife(units);
  }, [convertVaultToLife]);

  /* ---- line rewards -------------------------------------------------- */
  // Resolved ONCE per completed line. The Hourglass pays only when the line's
  // own timer was still running; the Vault opens only when the student actually
  // followed the teacher's expected method.
  const consumeLine = useCallback((lineNumber: number) => {

    if (!question) return;
    const row = lines.find((l) => l.line === lineNumber);
    if (!row || row.rewards.length === 0) return;
    const work = workRef.current[lineNumber - 1] ?? "";
    const inTime = !expiredLines.current.has(lineNumber);
    const keys: string[] = [];
    let vaultGain = 0;
    let lifeGain = 0;
    let secondsGain = 0;

    for (const reward of row.rewards) {
      const key = rewardKey(question.questionRowId, lineNumber, reward.id);
      if (consumed.includes(key)) continue;

      if (reward.type === "math-vault") {
        // A Vault Code opens only on its own mathematics, recognised inside the
        // student's work, and pays its own reward. Unrecognised codes stay shut.
        const wanted = reward.expression ?? row.vaultExpression;
        if (!vaultMatches(wanted, work)) continue;
        keys.push(key);
        vaultGain += reward.coins ?? row.vaultCoins;
        continue;
      }

      keys.push(key);
      if (reward.type === "time-shard") {
        // Hourglass -> Time: the time it holds, times the teacher's factor.
        if (inTime) secondsGain += Math.round(row.hourglassSeconds * conversion.hourglassToTime);
        continue;
      }
      // A Life is STORED as a Life. It becomes Time only when it is spent.
      lifeGain += REWARD_LIVES[reward.type] ?? 0;
    }

    if (keys.length === 0) return;
    setConsumed((prev) => [...prev, ...keys]);
    if (vaultGain) {
      setVaultReward((prev) => prev + vaultGain);
      convertVaultToLife(vaultGain);
    }
    if (lifeGain) setLives((prev) => Math.max(0, prev + lifeGain));
    if (secondsGain) {
      setQuestionDeadline((prev) => (prev ? prev + secondsGain * 1000 : prev));
    }
  }, [question, lines, consumed, conversion, convertVaultToLife]);

  /* Vault Codes listen to live mathematical work. They are independent of the
     final-answer completion event, pay only through openVaultOnly (never any
     mark), and each opens at most once. A Vault may therefore open on a line
     that is still unfinished, and a line may be marked with no Vault open. */
  useEffect(() => {
    if (!question) return;
    for (const row of lines) {
      if (row.isQuestion) continue;
      const work = lineText[row.line - 1] ?? "";
      if (!work) continue;
      for (const reward of row.rewards) {
        if (reward.type !== "math-vault") continue;
        const key = rewardKey(question.questionRowId, row.line, reward.id);
        if (consumed.includes(key) || !vaultMatches(reward.expression, work)) continue;
        openVaultOnly(key, reward.coins ?? row.vaultCoins);
      }
    }
  }, [question, lines, lineText, consumed, openVaultOnly]);


  const consumeWorldReward = useCallback((lineNumber: number, renderedRewardId: string) => {
    if (!question) return;
    const row = lines.find((item) => item.line === lineNumber);
    const prefix = `${lineNumber}-`;
    const originalId = renderedRewardId.startsWith(prefix)
      ? renderedRewardId.slice(prefix.length)
      : renderedRewardId;
    const reward = row?.rewards.find((item) => item.id === originalId);
    if (!reward) return;
    // The Vault and the Completion coin answer only to the student's own
    // mathematics: no Bomb and no Collector can ever open them.
    if (reward.type === "math-vault" || reward.type === "mark-seal") return;
    const key = rewardKey(question.questionRowId, lineNumber, reward.id);
    if (consumed.includes(key)) return;
    // An Hourglass arriving here has run out: it dissolves for good, unpaid.
    if (reward.type === "time-shard") {
      expiredLines.current.add(lineNumber);
      setConsumed((prev) => prev.includes(key) ? prev : [...prev, key]);
      return;
    }
    setConsumed((prev) => prev.includes(key) ? prev : [...prev, key]);
    if (reward.type === "retry-heart") {
      // Stored as a Life only: it pays Time when the Game time runs out.
      setLives((prev) => prev + 1);
    }
  }, [question, lines, consumed]);

  /* Vault totals for the strip: opened against everything this question holds. */
  const vaultsTotal = useMemo(
    () => lines.reduce((sum, row) => sum + row.rewards.filter((r) => r.type === "math-vault").length, 0),
    [lines],
  );
  const vaultsOpened = useMemo(() => {
    if (!question) return 0;
    const prefix = `${question.questionRowId}:`;
    return consumed.filter((key) => key.startsWith(prefix) && key.includes(":vault-")).length;
  }, [consumed, question]);

  /* ---- sound ----------------------------------------------------------
   * An extra layer only. A reward sitting on the line is silent; its sound
   * fires at the exact moment its existing activation is recorded, and never
   * touches mathematics, marks, timers or progress.
   */
  const soundSettings = useMemo(
    () => normalizeSoundSettings(game?.settings.sound),
    [game?.settings.sound],
  );
  useEffect(() => {
    prepareGameSounds(soundSettings);
  }, [soundSettings]);
  useEffect(() => {
    applyBackgroundSound(soundSettings.background);
    return () => stopBackgroundSound();
    // only the chosen sound and its volume may restart playback — never a line change
  }, [soundSettings.background.ref?.path, soundSettings.background.enabled]);
  useEffect(() => {
    setBackgroundVolume(soundSettings.background.volume);
  }, [soundSettings.background.volume]);

  const heardRewards = useRef<Set<string> | null>(null);
  useEffect(() => {
    // the first pass only remembers what was already activated before this run
    if (heardRewards.current === null) {
      heardRewards.current = new Set(consumed);
      return;
    }
    const heard = heardRewards.current;
    for (const key of consumed) {
      if (heard.has(key)) continue;
      heard.add(key);
      const parts = key.split(":");
      const lineNumber = Number(parts[1]);
      const rewardId = parts.slice(2).join(":");
      const row = lines.find((entry) => entry.line === lineNumber);
      const reward = row?.rewards.find((entry) => entry.id === rewardId);
      const soundKey = reward ? rewardSoundKeyForType(reward.type) : null;
      if (soundKey) playRewardSound(soundSettings, soundKey);
    }
  }, [consumed, lines, soundSettings]);

  const heardCompletion = useRef<number | null>(null);
  useEffect(() => {
    if (heardCompletion.current === null) {
      heardCompletion.current = completionCount;
      return;
    }
    if (completionCount > heardCompletion.current) playRewardSound(soundSettings, "completion");
    heardCompletion.current = completionCount;
  }, [completionCount, soundSettings]);



  /* ---- board bridge -------------------------------------------------- */
  const acceptLineAward = useCallback((event: GameLineAward) => {
    if (!question || event.questionId !== question.boardQuestionId) return;
    const awardedExpression = event.studentAscii.trim();
    const index = question.lineIds.indexOf(event.lineId);
    if (index < 0 || !awardedExpression) return;

    const key = `${question.questionRowId}:${event.lineId}`;
    if (awarded.current.has(key)) return;
    awarded.current.add(key);

    const lineKey = `${question.questionRowId}:${event.lineId}`;
    setCompletedLineKeys((prev) => prev.includes(lineKey) ? prev : [...prev, lineKey]);
    setCompletionCount((prev) => prev + 1);
    convertCompletionToLife(1);
    setCompletedLines((prev) => (prev.includes(index + 1) ? prev : [...prev, index + 1]));
    consumeLine(index + 1);
    // The Game's configured marks remain authoritative. Never trust a caller
    // to invent a different score, even though the board supplies its value.
    setEarnedMarks((prev) => prev + (question.lineMarks[index] ?? 0));
  }, [question, consumeLine, convertCompletionToLife]);

  const onLineContext = useCallback((ctx: LineContext) => {
    if (!question) return;
    const lineNumber = ctx.index + 1;

    // The line's own time comes from Floating Numbers and starts on the first
    // mathematical input on that line — never on seeing or scrolling to it.
    const row = lines.find((l) => l.line === lineNumber);
    // Two mathematical entries on THIS line start its own Hourglass. Nothing
    // else does: not seeing the line, not scrolling to it, not one stray tap.
    const entries = (workRef.current[lineNumber - 1] ?? "").replace(/\s+/g, "").length;
    const started = ctx.lineEngaged
      && entries >= 2
      && Boolean(row?.timerSeconds)
      && !ctx.completed
      && !expiredLines.current.has(lineNumber);
    if (started) {
      setLineDeadline((prev) => {
        if (prev && timedLine.current === lineNumber) return prev;
        timedLine.current = lineNumber;
        setRunningLine(lineNumber);
        return Date.now() + row!.timerSeconds! * 1000;
      });
    } else if (!row?.timerSeconds || ctx.completed) {
      if (timedLine.current === lineNumber || !row?.timerSeconds) {
        timedLine.current = null;
        setRunningLine(null);
        setLineDeadline(null);
      }
    }

    const awardedId = ctx.lastAwardedLineId;
    if (awardedId) {
      const awardedExpression = ctx.lastAwardedExpression?.trim() ?? "";
      if (awardedExpression) acceptLineAward({
        questionId: question.boardQuestionId,
        lineId: awardedId,
        studentAscii: awardedExpression,
        marks: question.lineMarks[question.lineIds.indexOf(awardedId)] ?? 0,
      });
    }

    const finished = ctx.total > 0 && ctx.index >= ctx.total - 1 && ctx.completed;
    if (!finished || completedQuestionIds.includes(question.questionRowId)) return;

    setCompletedQuestionIds((prev) => [...prev, question.questionRowId]);
    if (!testMode && assignmentId && studentId) {
      void saveGameQuestionResult({
        assignmentId,
        questionId: question.questionRowId,
        marksEarned: question.totalMarks,
        marksTotal: question.totalMarks,
        completed: true,
      });
    }
    if (questionIndex + 1 < boards.length) {
      setQuestionIndex(questionIndex + 1);
      setCurrentLine(1);
      setCompletedLines([]);
      setMessage("Question complete — next question.");
    } else {
      setStatus("complete");
      setMessage("Game complete.");
    }
  }, [
    question, lines, consumeLine, completedQuestionIds, testMode, assignmentId,
    studentId, questionIndex, boards.length, acceptLineAward,
  ]);


  /* ---- line timer expiry --------------------------------------------- */
  useEffect(() => {
    if (!lineDeadline) return;
    let done = false;
    const stop = subscribeGameClock((now) => {
      if (done || now < lineDeadline) return;
      done = true;
      // The Hourglass dissolves for good: no time reward, and no penalty.
      const line = timedLine.current;
      if (line) {
        expiredLines.current.add(line);
        if (question) {
          const key = rewardKey(question.questionRowId, line, "hourglass");
          setConsumed((prev) => prev.includes(key) ? prev : [...prev, key]);
        }
      }
      timedLine.current = null;
      setRunningLine(null);
      setLineDeadline(null);
      setMessage("Line time ran out — the Hourglass dissolved. Keep solving.");
    });
    return stop;
  }, [lineDeadline, question]);

  const goToQuestion = useCallback((index: number) => {
    if (index < 0 || index >= boards.length) return;
    setQuestionIndex(index);
    setCurrentLine(1);
    setCompletedLines([]);
  }, [boards.length]);

  /** A tapped Game surface selects its one-to-one Floating Numbers Line. */
  const selectLine = useCallback((line: number) => {
    if (!Number.isFinite(line)) return;
    const target = Math.floor(line);
    if (target < 1) return;
    const lastLine = Math.max(1, lines.length - 1);
    setCurrentLine(Math.min(target, lastLine));
  }, [lines.length]);

  const restartQuestion = useCallback(() => {
    startQuestionTimer(question?.questionTimerSeconds ?? null);
    setLineDeadline(null);
    setRunningLine(null);
    timedLine.current = null;
    expiredLines.current = new Set();
    setCurrentLine(1);
    setCompletedLines([]);
  }, [question, startQuestionTimer]);

  const restartGame = useCallback(async () => {
    // Remove only this student's saved run. The zeroed state below may create
    // a fresh progress row later; the teacher's Game and questions are untouched.
    if (!testMode && studentId && game) {
      let query = supabase
        .from("slate_game_progress")
        .delete()
        .eq("game_id", game.id)
        .eq("student_id", studentId);
      query = assignmentId
        ? query.eq("assignment_id", assignmentId)
        : query.is("assignment_id", null);
      const { error } = await query;
      if (error) throw new Error(error.message);
      rowId.current = null;
    }
    setQuestionIndex(0);
    setCurrentLine(1);
    setCompletedQuestionIds([]);
    setCompletedLines([]);
    setConsumed([]);
    setVaultReward(0);
    setCompletionCount(0);
    setCompletedLineKeys([]);
    setLives(game?.status?.lives ?? 3);
    setEarnedMarks(0);
    setStatus("in_progress");
    awarded.current = new Set();
    pendingVaultLife.current = 0;
    pendingCompletionLife.current = 0;
    expiredLines.current = new Set();
    timedLine.current = null;
    setRunningLine(null);
    setLineDeadline(null);
    setMessage(null);
    startQuestionTimer(boards[0]?.questionTimerSeconds ?? null);
  }, [game, boards, startQuestionTimer, testMode, studentId, assignmentId]);

  return {
    ready,
    questionIndex,
    question,
    lines,
    currentLine,
    completedQuestionIds,
    completedLines,
    consumedRewardKeys: consumed,
    vaultReward,
    vaultsOpened,
    vaultsTotal,
    timedLine: runningLine,
    completionCount,
    lives,
    questionDeadline,
    lineDeadline,
    status,
    earnedMarks,
    totalMarks,
    message,
    onLineContext,
    onLineAward: acceptLineAward,
    consumeWorldReward,
    selectLine,
    goToQuestion,
    restartQuestion,
    restartGame,
    dismissMessage: () => setMessage(null),
  };
};
