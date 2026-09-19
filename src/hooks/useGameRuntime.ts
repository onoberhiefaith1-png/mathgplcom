// Game Play runtime.
//
// It owns ONLY the game world's own state: which question and Line the student
// is on, coins, lives, timers and which physical rewards have been consumed.
// Mathematics, marking and the board itself stay entirely inside the existing
// Floating Numbers / Smartboard engine — this hook never grades anything.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapQuestionLines, type MappedLine } from "@/lib/slate/pattern";
import { fractionSeconds, vaultMatches } from "@/lib/slate/lineSurfaces";
import type { Game } from "@/lib/slate/types";
import type { GameQuestionBoard } from "@/lib/slate/gameBoard";
import { saveGameQuestionResult } from "@/lib/slate/gameAssignments";

export interface LineContext {
  questionId: string | null;
  lineId: string | null;
  index: number;
  total: number;
  completed: boolean;
  lastAwardedLineId?: string | null;
  lineEngaged?: boolean;
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
  coins: number;
  lives: number;
  /** Epoch ms the question timer runs out, or null when there is no timer. */
  questionDeadline: number | null;
  lineDeadline: number | null
  status: "in_progress" | "complete" | "failed";
  earnedMarks: number;
  totalMarks: number;
  message: string | null;
  onLineContext: (ctx: LineContext) => void;
  /** Game Lines own line navigation — a tapped Game Line calls this. */
  selectLine: (line: number) => void;
  goToQuestion: (index: number) => void;
  restartQuestion: () => void;
  restartGame: () => void;
  dismissMessage: () => void;
}

const REWARD_COINS: Record<string, number> = { "mark-seal": 1 };
const REWARD_LIVES: Record<string, number> = { "retry-heart": 1, "math-core": -1 };

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
  const [coins, setCoins] = useState(0);
  const [lives, setLives] = useState(3);
  const [questionDeadline, setQuestionDeadline] = useState<number | null>(null);
  const [lineDeadline, setLineDeadline] = useState<number | null>(null);
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
    () => (game && question ? mapQuestionLines(game, question.lineTimers, question.lineIds) : []),
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
        .select("id, question_index, current_line, completed_question_ids, consumed_reward_keys, coins, lives, status")
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
        lives: number;
        status: string;
      } | null;
      if (row) {
        rowId.current = row.id;
        setQuestionIndex(Math.min(row.question_index, Math.max(0, boards.length - 1)));
        setCurrentLine(Math.max(1, row.current_line));
        setCompletedQuestionIds(row.completed_question_ids ?? []);
        setConsumed(row.consumed_reward_keys ?? []);
        setCoins(row.coins);
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
          coins,
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
    completedQuestionIds, consumed, coins, lives, status,
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

  /** A Life gives back a teacher-set fraction of the ORIGINAL question time. */
  const lifeSeconds = useCallback(
    () =>
      fractionSeconds(
        question?.questionTimerSeconds ?? null,
        game?.settings.life?.fraction ?? "full",
      ),
    [question, game],
  );

  useEffect(() => {
    if (!questionDeadline) return;
    const tick = window.setInterval(() => {
      if (Date.now() < questionDeadline) return;
      window.clearInterval(tick);
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
        const seconds = lifeSeconds();
        setMessage(
          seconds
            ? `Time ran out — one life used, ${Math.round(seconds / 60) || 1} more minute(s) of question time.`
            : "Time ran out — one life used.",
        );
        startQuestionTimer(seconds || null);
        return next;
      });
    }, 500);
    return () => window.clearInterval(tick);
  }, [questionDeadline, lifeSeconds, startQuestionTimer]);

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
    let coinGain = 0;
    let lifeGain = 0;
    let secondsGain = 0;

    for (const reward of row.rewards) {
      const key = rewardKey(question.questionRowId, lineNumber, reward.id);
      if (consumed.includes(key)) continue;
      keys.push(key);

      if (reward.type === "time-shard") {
        // solved inside the line's own time → the configured share of it
        if (inTime) secondsGain += row.hourglassSeconds;
        continue;
      }
      if (reward.type === "math-vault") {
        // each Vault Code opens on its own mathematics, and pays its own reward
        const wanted = reward.expression ?? row.vaultExpression;
        if (vaultMatches(wanted, work)) coinGain += reward.coins ?? row.vaultCoins;
        continue;
      }
      coinGain += REWARD_COINS[reward.type] ?? 0;
      lifeGain += REWARD_LIVES[reward.type] ?? 0;
    }

    if (keys.length === 0) return;
    setConsumed((prev) => [...prev, ...keys]);
    if (coinGain) setCoins((prev) => prev + coinGain);
    if (lifeGain) setLives((prev) => Math.max(0, prev + lifeGain));
    if (secondsGain) {
      setQuestionDeadline((prev) => (prev ? prev + secondsGain * 1000 : prev));
    }
  }, [question, lines, consumed]);

  /* ---- board bridge -------------------------------------------------- */
  const onLineContext = useCallback((ctx: LineContext) => {
    if (!question) return;
    const lineNumber = ctx.index + 1;
    setCurrentLine(lineNumber);

    // The line's own time comes from Floating Numbers and starts on the first
    // mathematical input on that line — never on seeing or scrolling to it.
    const row = lines.find((l) => l.line === lineNumber);
    const started = ctx.lineEngaged
      && Boolean(row?.timerSeconds)
      && !ctx.completed
      && !expiredLines.current.has(lineNumber);
    if (started) {
      setLineDeadline((prev) => {
        if (prev && timedLine.current === lineNumber) return prev;
        timedLine.current = lineNumber;
        return Date.now() + row!.timerSeconds! * 1000;
      });
    } else if (!row?.timerSeconds || ctx.completed) {
      if (timedLine.current === lineNumber || !row?.timerSeconds) {
        timedLine.current = null;
        setLineDeadline(null);
      }
    }

    const awardedId = ctx.lastAwardedLineId;
    if (awardedId) {
      const key = `${question.questionRowId}:${awardedId}`;
      if (!awarded.current.has(key)) {
        awarded.current.add(key);
        const index = question.lineIds.indexOf(awardedId);
        if (index >= 0) {
          setCompletedLines((prev) => (prev.includes(index + 1) ? prev : [...prev, index + 1]));
          consumeLine(index + 1);
          setEarnedMarks((prev) => prev + (question.lineMarks[index] ?? 0));
        }
      }
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
    studentId, questionIndex, boards.length,
  ]);

  /* ---- line timer expiry --------------------------------------------- */
  useEffect(() => {
    if (!lineDeadline) return;
    const tick = window.setInterval(() => {
      if (Date.now() < lineDeadline) return;
      window.clearInterval(tick);
      // The Hourglass dissolves: no time reward, and no penalty either.
      if (timedLine.current) expiredLines.current.add(timedLine.current);
      timedLine.current = null;
      setLineDeadline(null);
      setMessage("Line time ran out — the Hourglass dissolved. Keep solving.");
    }, 500);
    return () => window.clearInterval(tick);
  }, [lineDeadline]);

  const goToQuestion = useCallback((index: number) => {
    if (index < 0 || index >= boards.length) return;
    setQuestionIndex(index);
    setCurrentLine(1);
    setCompletedLines([]);
  }, [boards.length]);

  /** A tapped Game Line. Never jumps past the line the student has reached. */
  const selectLine = useCallback((line: number) => {
    if (!Number.isFinite(line)) return;
    const target = Math.floor(line);
    if (target < 1) return;
    const reached = Math.max(1, ...completedLines.map((l) => l + 1), currentLine);
    setCurrentLine(Math.min(target, reached));
  }, [completedLines, currentLine]);

  const restartQuestion = useCallback(() => {
    startQuestionTimer(question?.questionTimerSeconds ?? null);
    setLineDeadline(null);
    timedLine.current = null;
    expiredLines.current = new Set();
    setCurrentLine(1);
    setCompletedLines([]);
  }, [question, startQuestionTimer]);

  const restartGame = useCallback(() => {
    setQuestionIndex(0);
    setCurrentLine(1);
    setCompletedQuestionIds([]);
    setCompletedLines([]);
    setConsumed([]);
    setCoins(0);
    setLives(game?.status?.lives ?? 3);
    setEarnedMarks(0);
    setStatus("in_progress");
    awarded.current = new Set();
    expiredLines.current = new Set();
    timedLine.current = null;
    startQuestionTimer(boards[0]?.questionTimerSeconds ?? null);
  }, [game, boards, startQuestionTimer]);

  return {
    ready,
    questionIndex,
    question,
    lines,
    currentLine,
    completedQuestionIds,
    completedLines,
    consumedRewardKeys: consumed,
    coins,
    lives,
    questionDeadline,
    lineDeadline,
    status,
    earnedMarks,
    totalMarks,
    message,
    onLineContext,
    selectLine,
    goToQuestion,
    restartQuestion,
    restartGame,
    dismissMessage: () => setMessage(null),
  };
};
