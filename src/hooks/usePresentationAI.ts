// Presentation AI — state machine hook.
// Owns autoplay, per-step inspection, repair orchestration, issue log, and
// the end-of-lesson report.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import { buildSteps, type PresentationStep } from "@/lib/smartboard/presentationAI/model";
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

  const applyStep = useCallback(
    (step: PresentationStep) => {
      // Set expected cursors so the Smartboard renders this step.
      ctrl.setBeatCursor(step.beatIndex);
      if (step.kind === "line") ctrl.setActiveLineIdx(step.lineIdx);
    },
    [ctrl],
  );

  const inspectAndBook = useCallback(
    (step: PresentationStep): Issue[] => {
      const found = inspectStep(step, ctrl);
      if (found.length > 0) {
        setIssues((prev) => [...prev, ...found]);
      }
      // stats accounting per step (only count on healthy pass)
      setStats((prev) => {
        const next = { ...prev };
        if (step.kind === "beat") next.beats += 1;
        else {
          next.lines += 1;
          if (step.line.fillers.length > 0) next.floating += 1;
          if ((step.line.notebook ?? "").trim()) next.notes += 1;
        }
        return next;
      });
      return found;
    },
    [ctrl],
  );

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

  // Keep refs so the async advance loop reads latest state.
  const issuesRef = useRef<Issue[]>([]);
  const resolvedRef = useRef<Set<string>>(new Set());
  const statsRef = useRef<StepStat>(emptyStats);
  useEffect(() => { issuesRef.current = issues; }, [issues]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  const scheduleNext = useCallback(
    (nextIndex: number) => {
      clearTimer();
      if (nextIndex >= steps.length) {
        // Small delay so the last render lands before we finalize.
        timerRef.current = window.setTimeout(() => finish(), 400);
        return;
      }
      const step = steps[nextIndex];
      const isLineStep = step.kind === "line";
      const delay = isLineStep ? SPEED_MS[speed] : Math.min(4_000, SPEED_MS[speed] / 3);
      timerRef.current = window.setTimeout(() => {
        setStepIndex(nextIndex);
        applyStep(step);
        // Give React one frame + a small settle window so the auto-reveal
        // effects (note-attention, floating carrier) get a chance to run.
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
      setIssues([]);
      setActiveIssue(null);
      setStats(emptyStats);
      setReport(null);
      resolvedRef.current = new Set();
      issuesRef.current = [];
      statsRef.current = emptyStats;
      startedAtRef.current = Date.now();
      setState("presenting");
      // Kick off from step 0 immediately.
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
    [applyStep, inspectAndBook, scheduleNext, steps],
  );

  const stop = useCallback(() => {
    clearTimer();
    setState("idle");
    setActiveIssue(null);
  }, []);

  const proceed = useCallback(() => {
    if (state !== "paused") return;
    if (activeIssue) {
      // Leave in issue log but no longer active.
      setActiveIssue(null);
    }
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
      // Re-inspect same step; if clean, continue.
      const remaining = inspectStep(currentStep, ctrl);
      if (remaining.length === 0) {
        setActiveIssue(null);
        setState("presenting");
        scheduleNext(stepIndex + 1);
        return;
      }
      // New issue surfaced by the repair — pause with the next one.
      setIssues((prev) => [...prev, ...remaining]);
      setActiveIssue(remaining[0]);
      setState("paused");
    } else {
      // Repair failed — mark the issue as non-repairable so the UI offers
      // "Generate Lovable Prompt" instead of Rectify again.
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
