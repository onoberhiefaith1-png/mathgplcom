import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Difficulty } from "@/lib/fraction-challenge/generator";

export type TimerSeconds = 30 | 60 | 120 | 180 | 300;

export const TIMER_OPTIONS: { value: TimerSeconds; label: string }[] = [
  { value: 30, label: "30s" },
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" },
  { value: 180, label: "3 min" },
  { value: 300, label: "5 min" },
];

export interface ObjectiveTarget {
  diamonds: number;
  hearts: number;
}

export const OBJECTIVES_BY_DIFFICULTY: Record<Difficulty, ObjectiveTarget> = {
  easy: { diamonds: 5, hearts: 3 },
  medium: { diamonds: 10, hearts: 5 },
  hard: { diamonds: 15, hearts: 8 },
};

interface Ctx {
  duration: TimerSeconds;
  setDuration: (v: TimerSeconds) => void;
  paused: boolean;
  setPaused: (v: boolean) => void;
  objectiveTarget: ObjectiveTarget;
  /** Bumps each time we want the timer to reset (e.g. on new question or settings change). */
  resetSignal: number;
  bumpReset: () => void;
}

const FractionGameCtx = createContext<Ctx | null>(null);

export const FractionGameProvider = ({
  children,
  difficulty,
}: {
  children: ReactNode;
  difficulty: Difficulty;
}) => {
  const [duration, setDurationState] = useState<TimerSeconds>(60);
  const [paused, setPaused] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const setDuration = useCallback((v: TimerSeconds) => {
    setDurationState(v);
    setResetSignal((n) => n + 1);
  }, []);
  const bumpReset = useCallback(() => setResetSignal((n) => n + 1), []);
  const setPausedStable = useCallback((v: boolean) => setPaused(v), []);

  const objectiveTarget = OBJECTIVES_BY_DIFFICULTY[difficulty];

  const value = useMemo<Ctx>(
    () => ({
      duration,
      setDuration,
      paused,
      setPaused: setPausedStable,
      objectiveTarget,
      resetSignal,
      bumpReset,
    }),
    [duration, setDuration, paused, setPausedStable, objectiveTarget, resetSignal, bumpReset],
  );
  return <FractionGameCtx.Provider value={value}>{children}</FractionGameCtx.Provider>;
};

export const useFractionGame = () => {
  const v = useContext(FractionGameCtx);
  if (!v) throw new Error("useFractionGame must be inside FractionGameProvider");
  return v;
};
