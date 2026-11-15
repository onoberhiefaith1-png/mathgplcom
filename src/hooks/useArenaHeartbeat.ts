// Timer Arena presence: while a student is in their teacher's group and the tab
// is visible, tell the server every BEAT_EVERY_MS so the Live Report can show
// them as active. Does nothing when the device is not in an Arena group.
import { useEffect } from "react";
import {
  activeArena,
  arenaBeat,
  flushArenaOutbox,
} from "@/lib/arena/arenaClient";
import { BEAT_EVERY_MS } from "@/lib/arena/presence";

export function useArenaHeartbeat(
  guestCode: string | null | undefined,
  token: string | null | undefined,
  assessmentId?: string | null,
) {
  useEffect(() => {
    if (!guestCode || !token || !activeArena(guestCode)) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      arenaBeat(guestCode, token, assessmentId);
      // A finish whose marking landed late (or whose send failed) stays queued;
      // keep re-sending it while the student is here, not only after a reload.
      void flushArenaOutbox();
    };
    const onBack = () => {
      beat();
      void flushArenaOutbox();
    };
    beat();
    void flushArenaOutbox();
    const id = window.setInterval(beat, BEAT_EVERY_MS);
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("online", onBack);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("online", onBack);
    };
  }, [guestCode, token, assessmentId]);
}
