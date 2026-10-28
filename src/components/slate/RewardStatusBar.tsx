import { useEffect, useState } from "react";
import type { GameStatus } from "@/lib/slate/types";

const remainingSeconds = (timerEndsAt: number | null) =>
  timerEndsAt ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)) : 0;

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

const icon = "h-3.5 w-3.5 shrink-0";

const VaultIcon = () => (
  <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 8.5V5.5M12 18.5v-3M15.5 12h3M5.5 12h3" />
  </svg>
);

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" className={icon} fill="currentColor" aria-hidden="true">
    <path d="M12 20.5 4.4 13a4.6 4.6 0 1 1 6.5-6.5l1.1 1.1 1.1-1.1A4.6 4.6 0 1 1 19.6 13Z" />
  </svg>
);

const TimeIcon = () => (
  <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export function RewardStatusBar({
  status,
  vaultsTotal,
}: {
  status: GameStatus;
  vaultsTotal: number;
}) {
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

  const total = Math.max(vaultsTotal, status.vaultsOpened);

  return (
    <div
      aria-label="Reward and status"
      className="pointer-events-none flex h-8 shrink-0 items-center divide-x divide-amber-100/15 overflow-hidden rounded border border-amber-100/15 bg-black/55 text-xs font-semibold tabular-nums text-amber-50 shadow-lg backdrop-blur-md"
    >
      <span
        className="flex h-full items-center gap-1.5 px-2.5 text-sky-200"
        aria-label={`${status.vaultsOpened} of ${total} vaults opened`}
      >
        <VaultIcon />
        <span>
          {status.vaultsOpened}
          <span className="text-sky-200/45">/{total}</span>
        </span>
      </span>
      <span
        className="flex h-full items-center gap-1.5 px-2.5 text-rose-300"
        aria-label={`${status.lives} lives`}
      >
        <HeartIcon />
        <span className="text-amber-50">{status.lives}</span>
      </span>
      {remaining > 0 ? (
        <span
          className="flex h-full items-center gap-1.5 px-2.5 text-amber-200"
          aria-label={`${formatTime(remaining)} remaining`}
        >
          <TimeIcon />
          <span className="text-amber-50">{formatTime(remaining)}</span>
        </span>
      ) : null}
    </div>
  );
}
