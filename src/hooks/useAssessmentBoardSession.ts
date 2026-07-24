// Shared assessment board session.
//
// ONE board state per (assessment, student). The student owns it; the teacher
// reviewing "View Student Work" joins the SAME session — read-only while in
// View Only mode, co-author when Edit mode is on. Low-latency updates travel
// over a private broadcast channel; a debounced write to
// `assessment_board_state` keeps the session durable so the teacher still sees
// the student's work when the student is offline.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";

export type AssessBoardState = {
  beatCursor: number;
  bandExtra: Record<string, number>;
  freeLines: unknown;
  lineOffsets: Record<number, number>;
  smartLines: unknown[];
  boxes: unknown[];
  sensor: { line: number; x: number };
  zoom: number;
  surface: string;
  profileId: string;
  inkColorId: string;
  placeholderColorId?: string;
  activeLineIdx: number;
  questionId: string | null;
};

export type AssessBoardSnapshot = AssessBoardState & {
  v: number;
  author: string;
  ts: number;
};

export function useAssessmentBoardSession(opts: {
  assessmentId?: string | null;
  studentId?: string | null;
  enabled: boolean;
}) {
  const { assessmentId, studentId, enabled } = opts;
  const active = enabled && !!assessmentId && !!studentId;

  const [selfId, setSelfId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<AssessBoardSnapshot | null>(null);

  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const bcTimer = useRef<number | null>(null);
  const dbTimer = useRef<number | null>(null);
  const lastFingerprint = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setSelfId(data.user?.id ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  // Durable state — load once so a joining teacher sees prior work.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    supabase
      .from("assessment_board_state")
      .select("state_json, author, updated_at")
      .eq("assessment_id", assessmentId!)
      .eq("student_id", studentId!)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data?.state_json) return;
        const sj = data.state_json as unknown;
        if (sj && typeof sj === "object" && Object.keys(sj).length > 0) {
          setIncoming(sj as AssessBoardSnapshot);
        }
      });
    return () => { cancelled = true; };
  }, [active, assessmentId, studentId]);

  // Live channel.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const name = `assessment-board-${assessmentId}-${studentId}`;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      const ch = supabase
        .channel(name, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "state" }, (msg) => {
          const p = (msg as { payload?: AssessBoardSnapshot }).payload;
          if (p) setIncoming(p);
        })
        .subscribe();
      chanRef.current = ch;
    });
    return () => {
      cancelled = true;
      if (chanRef.current) {
        supabase.removeChannel(chanRef.current);
        chanRef.current = null;
      }
    };
  }, [active, assessmentId, studentId]);

  const push = useCallback((state: AssessBoardState) => {
    if (!active || !selfId) return;
    const fingerprint = JSON.stringify(state);
    if (fingerprint === lastFingerprint.current) return;
    lastFingerprint.current = fingerprint;

    const snapshot: AssessBoardSnapshot = { v: 1, author: selfId, ts: Date.now(), ...state };

    // Fast path — broadcast (≈live TV latency).
    if (bcTimer.current) window.clearTimeout(bcTimer.current);
    bcTimer.current = window.setTimeout(() => {
      const ch = chanRef.current;
      if (!ch) return;
      void ch.send({ type: "broadcast", event: "state", payload: snapshot });
    }, 90);

    // Durable path — debounced upsert.
    if (dbTimer.current) window.clearTimeout(dbTimer.current);
    dbTimer.current = window.setTimeout(() => {
      void supabase
        .from("assessment_board_state")
        .upsert(
          {
            assessment_id: assessmentId!,
            student_id: studentId!,
            state_json: snapshot as never,
            question_id: state.questionId,
            active_line_idx: Math.max(0, Math.floor(state.activeLineIdx ?? 0)),
            author: selfId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "assessment_id,student_id" },
        );
    }, 1200);
  }, [active, assessmentId, studentId, selfId]);

  useEffect(() => () => {
    if (bcTimer.current) window.clearTimeout(bcTimer.current);
    if (dbTimer.current) window.clearTimeout(dbTimer.current);
  }, []);

  return { sessionActive: active, selfId, incoming, push };
}
