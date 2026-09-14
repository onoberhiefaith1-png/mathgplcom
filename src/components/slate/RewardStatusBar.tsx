import { useEffect, useState } from "react";
import type { GameStatus } from "@/lib/slate/types";

const remainingSeconds = (timerEndsAt: number | null) =>
  timerEndsAt ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)) : 0;

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

export function RewardStatusBar({ status }: { status: GameStatus }) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(status.timerEndsAt));

  useEffect(() => {
    setRemaining(remainingSeconds(status.timerEndsAt));
    if (!status.timerEndsAt || status.timerEndsAt <= Date.now()) return;
    const interval = window.setInterval(
      () => setRemaining(remainingSeconds(status.timerEndsAt)),
      250,
    );
    return () => window.clearInterval(interval);
  }, [status.timerEndsAt]);

  return (
    <div
      aria-label="Reward and status"
      className="pointer-events-none flex h-8 shrink-0 items-center divide-x divide-amber-100/15 overflow-hidden rounded border border-amber-100/15 bg-black/55 text-xs font-semibold tabular-nums text-amber-50 shadow-lg backdrop-blur-md"
    >
      <span className="flex h-full items-center gap-1.5 px-2.5" aria-label={`${status.coins} coins`}>
        <span aria-hidden="true">🪙</span>
        <span>{status.coins}</span>
      </span>
      <span className="flex h-full items-center gap-1.5 px-2.5" aria-label={`${status.lives} lives`}>
        <span aria-hidden="true">❤️</span>
        <span>{status.lives}</span>
      </span>
      {remaining > 0 ? (
        <span className="flex h-full items-center gap-1.5 px-2.5" aria-label={`${formatTime(remaining)} remaining`}>
          <span aria-hidden="true">⏳</span>
          <span>{formatTime(remaining)}</span>
        </span>
      ) : null}
    </div>
  );
}