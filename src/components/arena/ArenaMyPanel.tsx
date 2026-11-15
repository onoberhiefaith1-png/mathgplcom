import { useEffect } from "react";
import { toast } from "sonner";
import { useArenaHeartbeat } from "@/hooks/useArenaHeartbeat";
import { flushArenaOutbox } from "@/lib/arena/arenaClient";
import type { SubmitEvent } from "@/lib/arena/submit";

/**
 * Reporting stays active without taking space from the floating-number toolbar.
 * A time that could not reach the teacher's Live Report is never silent: the
 * student gets a short message with Retry, and a confirmation once it lands.
 */
export default function ArenaMyPanel({ guestCode, token, assessmentId }: { guestCode: string; token: string; assessmentId: string }) {
  useArenaHeartbeat(guestCode, token, assessmentId);
  useEffect(() => {
    const troubled = new Set<string>();
    const onSubmit = (ev: Event) => {
      const e = (ev as CustomEvent<SubmitEvent>).detail;
      if (!e) return;
      const id = `arena-submit:${e.assessmentId}`;
      if (e.state === "failed") {
        troubled.add(e.assessmentId);
        toast.error(e.message ?? "Your time couldn't reach the Live Report.", {
          id,
          duration: 12_000,
          ...(e.retryable === false ? {} : { action: { label: "Retry", onClick: () => void flushArenaOutbox(e.assessmentId) } }),
        });
      } else if (e.state === "saved" && troubled.delete(e.assessmentId)) {
        toast.success(e.counted ? "Your time is on the Live Report." : "Your result reached the Live Report.", { id, duration: 4000 });
      }
    };
    window.addEventListener("arena:submit", onSubmit);
    return () => window.removeEventListener("arena:submit", onSubmit);
  }, []);
  return null;
}
