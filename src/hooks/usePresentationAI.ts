// Presentation AI — state machine hook.
// Owns autoplay, per-step inspection, repair orchestration, issue log, and
// the end-of-lesson report. Steps are fine-grained: beat → line-start →
// filler₀…fillerₙ → note? → line-verify, so the AI performs each solution
// line the way a teacher would — building the equation token by token.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import {
  buildSteps,
  isQuestionLine,
  lineSubStepCount,
  type PresentationStep,
} from "@/lib/smartboard/presentationAI/model";
import { inspectStep, inspectStructure } from "@/lib/smartboard/presentationAI/inspector";
import { runRepair } from "@/lib/smartboard/presentationAI/repairs";
import {
  SPEED_MS,
  type AIState,
  type FinalReport,
  type Issue,
  type SpeedPreset,
  type StepStat,
} from "@/lib/smartboard/presentationAI/types";

export interface UsePresentationAIResult {
  state: AIState;
  speed: SpeedPreset;
  setSpeed: (s: SpeedPreset) => void;
  currentStep: PresentationStep | null;
  stepIndex: number;
  totalSteps: number;
  activeIssue: Issue | null;
  issues: Issue[]; // full log
  stats: StepStat;
  report: FinalReport | null;
  start: (speed?: SpeedPreset) => void;
  stop: () => void;
  proceed: () => void;
  rectify: () => Promise<void>;
  dismissActive: () => void;
}

const emptyStats: StepStat = { beats: 0, lines: 0, floating: 0, notes: 0, repairs: 0 };

const MIN_TICK_MS = 250;

/** Pacing per sub-step type, derived from the speed preset's total per-line budget. */
const paceForStep = (step: PresentationStep, speed: SpeedPreset): number => {
  const perLine = SPEED_MS[speed];
  if (step.kind === "beat") return Math.min(4_000, Math.max(600, perLine / 4));
  const subSteps = Math.max(2, lineSubStepCount(step.line));
  const slice = Math.max(MIN_TICK_MS, Math.floor(perLine / subSteps));
  // Line-start is a brief anchor; verify gets a small settle window.
  if (step.kind === "line-start") return Math.max(MIN_TICK_MS, Math.floor(slice / 2));
  if (step.kind === "line-verify") return Math.max(MIN_TICK_MS, Math.floor(slice / 2));
  return slice;
};

export const usePresentationAI = (
  ctrl: PresentationController,
): UsePresentationAIResult => {
  const steps = useMemo(
    () => buildSteps(ctrl.beats, ctrl.reservoirs),
    [ctrl.beats, ctrl.reservoirs],
  );

  const [state, setState] = useState<AIState>("idle");
  const [speed, setSpeed] = useState<SpeedPreset>("standard");
  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [stats, setStats] = useState<StepStat>(emptyStats);
  const [report, setReport] = useState<FinalReport | null>(null);
  const startedAtRef = useRef<number>(0);

  const timerRef = useRef<number | null>(null);
  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const currentStep = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
  const totalSteps = steps.length;

  /** Apply the side-effect that this step describes (cursor moves, writes). */
  const applyStep = useCallback(
    (step: PresentationStep) => {
      if (step.kind === "beat") {
        ctrl.setBeatCursor(step.beatIndex);
        return;
      }
      ctrl.setBeatCursor(step.beatIndex);
      ctrl.setActiveLineIdx(step.lineIdx);
      if (step.kind === "line-start") {
        // Open the # panel and point it at this line — the visible teacher
        // gesture. Fine to no-op if the controller doesn't expose it.
        ctrl.openFloatingPanel?.(step.lineIdx);
        return;
      }
      if (step.kind === "filler") {
        // Teacher move: click the chip on the # panel. Falls back to the
        // legacy prefix writer if the controller doesn't implement it.
        if (ctrl.pickFloatingNumber) ctrl.pickFloatingNumber(step.lineIdx, step.fillerIdx);
        else ctrl.writeEquationPrefix(step.lineIdx, step.fillerIdx + 1);
        return;
      }
      if (step.kind === "note") {
        // Close the # panel before dropping the Teacher Note so the note
        // lands on a clean surface instead of behind the chip tray.
        ctrl.closeFloatingPanel?.();
        const raw = (step.line.notebook ?? "").trim();
        if (raw) {
          ctrl.writeProseLineOnBoard(raw);
          ctrl.markNotebookShown(step.lineIdx);
          ctrl.addNotebookAttention(step.lineIdx);
        }
        return;
      }
      if (step.kind === "line-verify") {
        // Belt-and-braces: ensure the completed row is on the board even if
        // an earlier filler tick missed. Idempotent by row signature.
        const totalFillers = (step.line.fillers ?? []).length;
        if (totalFillers > 0) ctrl.writeEquationPrefix(step.lineIdx, totalFillers);
      }
    },
    [ctrl],
  );

  const bookStats = useCallback((step: PresentationStep) => {
    setStats((prev) => {
      const next = { ...prev };
      if (step.kind === "beat") next.beats += 1;
      else if (step.kind === "line-start") next.lines += 1;
      else if (step.kind === "filler") next.floating += 1;
      else if (step.kind === "note") next.notes += 1;
      return next;
    });
  }, []);

  const inspectAndBook = useCallback(
    (step: PresentationStep): Issue[] => {
      const found = inspectStep(step, ctrl);
      if (found.length > 0) setIssues((prev) => [...prev, ...found]);
      bookStats(step);
      return found;
    },
    [bookStats, ctrl],
  );

  // Keep refs so the async advance loop reads latest state.
  const issuesRef = useRef<Issue[]>([]);
  const resolvedRef = useRef<Set<string>>(new Set());
  const statsRef = useRef<StepStat>(emptyStats);
  useEffect(() => { issuesRef.current = issues; }, [issues]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  const finish = useCallback(() => {
    clearTimer();
    const unresolved = issuesRef.current.filter((i) => !resolvedRef.current.has(i.id));
    const structural = inspectStructure(ctrl);
    const all = [...unresolved, ...structural];
    setReport({
      status: all.length === 0 ? "PASS" : "FAIL",
      stats: statsRef.current,
      unresolved: all,
      startedAt: startedAtRef.current,
      finishedAt: Date.now(),
    });
    setState("reporting");
    setActiveIssue(null);
  }, [ctrl]);

  const scheduleNext = useCallback(
    (nextIndex: number) => {
      clearTimer();
      if (nextIndex >= steps.length) {
        timerRef.current = window.setTimeout(() => finish(), 400);
        return;
      }
      const step = steps[nextIndex];
      const delay = paceForStep(step, speed);
      timerRef.current = window.setTimeout(() => {
        setStepIndex(nextIndex);
        applyStep(step);
        // Give React one frame + a small settle window so auto-reveal
        // effects (note-attention, floating carrier) have a chance to run.
        window.setTimeout(() => {
          const found = inspectAndBook(step);
          if (found.length > 0) {
            setActiveIssue(found[0]);
            setState("paused");
            return;
          }
          scheduleNext(nextIndex + 1);
        }, 200);
      }, delay);
    },
    [applyStep, finish, inspectAndBook, speed, steps],
  );

  const start = useCallback(
    (s?: SpeedPreset) => {
      if (steps.length === 0) return;
      clearTimer();
      if (s) setSpeed(s);
      // Wipe the Smartboard — Autoplay must always start from a blank
      // surface so the AI reconstructs the full solution from scratch.
      ctrl.resetBoard?.();
      setIssues([]);
      setActiveIssue(null);
      setStats(emptyStats);
      setReport(null);
      resolvedRef.current = new Set();
      issuesRef.current = [];
      statsRef.current = emptyStats;
      startedAtRef.current = Date.now();
      setState("presenting");
      const first = steps[0];
      setStepIndex(0);
      applyStep(first);
      window.setTimeout(() => {
        const found = inspectAndBook(first);
        if (found.length > 0) {
          setActiveIssue(found[0]);
          setState("paused");
          return;
        }
        scheduleNext(1);
      }, 200);
    },
    [applyStep, ctrl, inspectAndBook, scheduleNext, steps],
  );

  const stop = useCallback(() => {
    clearTimer();
    setState("idle");
    setActiveIssue(null);
  }, []);

  const proceed = useCallback(() => {
    if (state !== "paused") return;
    if (activeIssue) setActiveIssue(null);
    setState("presenting");
    scheduleNext(stepIndex + 1);
  }, [activeIssue, scheduleNext, state, stepIndex]);

  const rectify = useCallback(async () => {
    if (!activeIssue || !currentStep) return;
    setState("repairing");
    const result = await runRepair(activeIssue, currentStep, ctrl);
    if (result.ok) {
      resolvedRef.current.add(activeIssue.id);
      setStats((prev) => ({ ...prev, repairs: prev.repairs + 1 }));
      const remaining = inspectStep(currentStep, ctrl);
      if (remaining.length === 0) {
        setActiveIssue(null);
        setState("presenting");
        scheduleNext(stepIndex + 1);
        return;
      }
      setIssues((prev) => [...prev, ...remaining]);
      setActiveIssue(remaining[0]);
      setState("paused");
    } else {
      setIssues((prev) =>
        prev.map((i) => (i.id === activeIssue.id ? { ...i, repairable: false } : i)),
      );
      setActiveIssue({ ...activeIssue, repairable: false });
      setState("paused");
    }
  }, [activeIssue, ctrl, currentStep, scheduleNext, stepIndex]);

  const dismissActive = useCallback(() => setActiveIssue(null), []);

  useEffect(() => () => clearTimer(), []);

  return {
    state,
    speed,
    setSpeed,
    currentStep,
    stepIndex,
    totalSteps,
    activeIssue,
    issues,
    stats,
    report,
    start,
    stop,
    proceed,
    rectify,
    dismissActive,
  };
};
