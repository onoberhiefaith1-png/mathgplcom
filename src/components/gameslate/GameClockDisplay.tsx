// The HUD countdown. It subscribes to the ONE game clock and re-renders only
// itself, so the 3D world and the writing surfaces are never re-rendered just
// because a second passed.

import { useEffect, useState } from "react";
import { secondsUntil, subscribeGameClock } from "@/lib/game/runtime/clock";
import { formatMmSs } from "@/lib/time/mmss";

interface Props {
  deadline: number | null;
  /** Rendered with the remaining seconds; nothing is shown when time is up. */
  children: (label: string, seconds: number) => React.ReactNode;
}

export function GameClockDisplay({ deadline, children }: Props) {
  const [seconds, setSeconds] = useState(() => secondsUntil(deadline));

  useEffect(() => {
    setSeconds(secondsUntil(deadline));
    if (!deadline) return;
    return subscribeGameClock((now) => {
      setSeconds((prev) => {
        const next = secondsUntil(deadline, now);
        return next === prev ? prev : next;
      });
    });
  }, [deadline]);

  if (seconds <= 0) return null;
  return <>{children(formatMmSs(seconds), seconds)}</>;
}
