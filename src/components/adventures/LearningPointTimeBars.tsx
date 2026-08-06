// Video Adventure — Learning Point Time Bars.
//
// Two faces, one component:
//  • Before the game starts: one Time Bar at a time (Time Bar 1, 2, 3 …) with
//    Previous / Next navigation, so the teacher can edit any Learning Point
//    without every Time Bar filling the screen.
//  • While a Learning Point is active: the live challenge — countdown, Time and
//    Required Mark. Everything here disappears when the challenge ends.
import { ChevronDown, ChevronUp, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import type { Scene } from "@/lib/games/types";
import { REQUIRED_MARK_OPTIONS, TIME_DURATION_OPTIONS } from "@/lib/games/types";
import type { ChallengeRow } from "@/hooks/useVideoAdventureRun";
import { DEFAULT_LP_DURATION_SECONDS, DEFAULT_REQUIRED_PCT } from "@/hooks/useVideoAdventureRun";

const SHELL = "rounded-lg border border-border bg-card/60 px-3 py-2 text-xs backdrop-blur";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

const durationOptions = TIME_DURATION_OPTIONS.filter((o) => o.seconds > 0);

interface Props {
  learningPoints: Scene[];
  challengeFor: (sceneId: string) => ChallengeRow | null;
  activeChallenge: ChallengeRow | null;
  remainingMs: number;
  onSetDuration: (sceneId: string, seconds: number) => void;
  onSetRequiredPct: (sceneId: string, pct: number) => void;
}

export function LearningPointTimeBars({
  learningPoints,
  challengeFor,
  activeChallenge,
  remainingMs,
  onSetDuration,
  onSetRequiredPct,
}: Props) {
  const [index, setIndex] = useState(0);

  // While a challenge runs, the panel follows the game.
  useEffect(() => {
    if (!activeChallenge) return;
    const i = learningPoints.findIndex((s) => s.id === activeChallenge.scene_id);
    if (i >= 0) setIndex(i);
  }, [activeChallenge, learningPoints]);

  if (learningPoints.length === 0) {
    return (
      <div className={SHELL}>
        <div className="mb-1 flex items-center gap-2">
          <Timer className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold">Time Bars</span>
        </div>
        <p className="text-muted-foreground">This Video Adventure has no Learning Points yet.</p>
      </div>
    );
  }

  const live = Boolean(activeChallenge);
  const point = learningPoints[Math.min(index, learningPoints.length - 1)];
  const row = challengeFor(point.id);
  const duration = row?.duration_seconds ?? DEFAULT_LP_DURATION_SECONDS;
  const requiredPct = row?.required_pct ?? DEFAULT_REQUIRED_PCT;
  const editable = !live || activeChallenge?.scene_id === point.id;

  return (
    <div className={SHELL}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Timer className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold">Time Bar {index + 1}</span>
        <span className="text-muted-foreground">· {point.title || `Learning Point ${index + 1}`}</span>
        {live && activeChallenge?.scene_id === point.id && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="tabular-nums text-primary">{fmt(remainingMs)} remaining</span>
            <span className="rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Active challenge
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Time</span>
          <select
            value={String(duration)}
            disabled={!editable}
            onChange={(e) => onSetDuration(point.id, Number(e.target.value))}
            className="h-7 rounded border border-input bg-background px-1.5 text-xs disabled:opacity-50"
          >
            {durationOptions.map((o) => (
              <option key={o.seconds} value={o.seconds}>{o.label}</option>
            ))}
            {!durationOptions.some((o) => o.seconds === duration) && (
              <option value={duration}>{Math.round(duration / 60)} minutes</option>
            )}
          </select>
        </label>

        <label className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Required Mark</span>
          <select
            value={String(requiredPct)}
            disabled={!editable}
            onChange={(e) => onSetRequiredPct(point.id, Number(e.target.value))}
            className="h-7 rounded border border-input bg-background px-1.5 text-xs disabled:opacity-50"
          >
            {REQUIRED_MARK_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}%</option>
            ))}
            {!REQUIRED_MARK_OPTIONS.includes(requiredPct) && (
              <option value={requiredPct}>{requiredPct}%</option>
            )}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronUp className="h-3 w-3" /> Previous
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(learningPoints.length - 1, i + 1))}
            disabled={index >= learningPoints.length - 1}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-40"
          >
            <ChevronDown className="h-3 w-3" /> Next Time Bar
          </button>
        </div>
      </div>

      {!editable && (
        <p className="mt-1.5 text-muted-foreground">
          A challenge is running on another Learning Point — its settings are locked until it ends.
        </p>
      )}
    </div>
  );
}

export default LearningPointTimeBars;
