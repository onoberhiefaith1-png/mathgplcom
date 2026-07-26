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
  /** When set, the board is scoped to ONE question — each question gets its
   *  own independent board so a previous solution can never bleed into the
   *  next question. */
  questionId?: string | null;
  enabled: boolean;
}) {
  const { assessmentId, studentId, questionId = null, enabled } = opts;
  const active = enabled && !!assessmentId && !!studentId;
  const perQuestion = !!questionId;

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
    const query = perQuestion
      ? supabase
          .from("assessment_question_board_state")
          .select("state_json, author, updated_at")
          .eq("assessment_id", assessmentId!)
          .eq("student_id", studentId!)
          .eq("question_id", questionId!)
          .maybeSingle()
      : supabase
          .from("assessment_board_state")
          .select("state_json, author, updated_at")
          .eq("assessment_id", assessmentId!)
          .eq("student_id", studentId!)
          .maybeSingle();
    query.then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.warn("[board-session] load failed", error.message);
        return;
      }
      if (!data?.state_json) return;
      const sj = data.state_json as unknown;
      if (sj && typeof sj === "object" && Object.keys(sj).length > 0) {
        setIncoming(sj as AssessBoardSnapshot);
      }
    });
    return () => { cancelled = true; };
  }, [active, assessmentId, studentId, questionId, perQuestion]);

  // Live channel. Self-healing: a join can fail if the socket token was not
  // ready yet, which would otherwise kill mirroring for the whole session.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let retries = 0;
    const name = `assessment-board-${assessmentId}-${studentId}${questionId ? `-${questionId}` : ""}`;

    const connect = () => {
      void ensureRealtimeAuth().then(() => {
        if (cancelled) return;
        const ch = supabase
          .channel(name, { config: { broadcast: { self: false } } })
          .on("broadcast", { event: "state" }, (msg) => {
            const p = (msg as { payload?: AssessBoardSnapshot }).payload;
            if (p) setIncoming(p);
          })
          .subscribe((status) => {
            if (cancelled) return;
            if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && retries < 3) {
              retries += 1;
              supabase.removeChannel(ch);
              if (chanRef.current === ch) chanRef.current = null;
              window.setTimeout(() => { if (!cancelled) connect(); }, 600 * retries);
            }
          });
        chanRef.current = ch;
      });
    };
    connect();

    return () => {
      cancelled = true;
      if (chanRef.current) {
        supabase.removeChannel(chanRef.current);
        chanRef.current = null;
      }
    };
  }, [active, assessmentId, studentId, questionId]);


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
      const activeLine = Math.max(0, Math.floor(state.activeLineIdx ?? 0));
      if (perQuestion) {
        void supabase
          .from("assessment_question_board_state")
          .upsert(
            {
              assessment_id: assessmentId!,
              student_id: studentId!,
              question_id: questionId!,
              state_json: snapshot as never,
              active_line_idx: activeLine,
              author: selfId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "assessment_id,student_id,question_id" },
          );
        return;
      }
      void supabase
        .from("assessment_board_state")
        .upsert(
          {
            assessment_id: assessmentId!,
            student_id: studentId!,
            state_json: snapshot as never,
            question_id: state.questionId,
            active_line_idx: activeLine,
            author: selfId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "assessment_id,student_id" },
        );
    }, 1200);
  }, [active, assessmentId, studentId, questionId, perQuestion, selfId]);


  useEffect(() => () => {
    if (bcTimer.current) window.clearTimeout(bcTimer.current);
    if (dbTimer.current) window.clearTimeout(dbTimer.current);
  }, []);

  return { sessionActive: active, selfId, incoming, push };
}
