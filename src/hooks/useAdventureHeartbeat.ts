// Heartbeat writer for the Adventure "In progress" bucket. The student page
// upserts an `adventure_live_sessions` row every 10s while they're on the
// question board. The teacher dashboard treats a heartbeat < 45s old as
// "in progress". Ported additively from gameful for Phase 2.

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_MS = 10_000;

export function useAdventureHeartbeat({
  enabled,
  classId,
  gameId,
  assessmentId,
  questionId,
  studentId,
}: {
  enabled: boolean;
  classId: string | null | undefined;
  gameId: string | null | undefined;
  assessmentId: string | null | undefined;
  questionId: string | null | undefined;
  studentId: string | null | undefined;
}) {
  useEffect(() => {
    if (!enabled || !classId || !gameId || !assessmentId || !studentId) return;
    let cancelled = false;

    const writeHeartbeat = async (isActive = true) => {
      if (cancelled && isActive) return;
      await supabase.from("adventure_live_sessions").upsert(
        {
          class_id: classId,
          game_id: gameId,
          assessment_id: assessmentId,
          question_id: questionId,
          student_id: studentId,
          is_active: isActive,
          last_seen_at: new Date().toISOString(),
        } as never,
        { onConflict: "class_id,game_id,assessment_id,student_id" },
      );
    };

    void writeHeartbeat(true);
    const interval = window.setInterval(() => { void writeHeartbeat(true); }, HEARTBEAT_MS);
    const markInactive = () => { void writeHeartbeat(false); };
    window.addEventListener("pagehide", markInactive);
    window.addEventListener("beforeunload", markInactive);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("pagehide", markInactive);
      window.removeEventListener("beforeunload", markInactive);
      void writeHeartbeat(false);
    };
  }, [enabled, classId, gameId, assessmentId, questionId, studentId]);
}
