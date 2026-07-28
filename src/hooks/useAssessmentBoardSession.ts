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

    const applyRow = (data: { state_json?: unknown } | null) => {
      if (cancelled || !data?.state_json) return false;
      const sj = data.state_json as unknown;
      if (sj && typeof sj === "object" && Object.keys(sj).length > 0) {
        setIncoming(sj as AssessBoardSnapshot);
        return true;
      }
      return false;
    };

    (async () => {
      if (perQuestion) {
        const { data, error } = await supabase
          .from("assessment_question_board_state")
          .select("state_json, author, updated_at")
          .eq("assessment_id", assessmentId!)
          .eq("student_id", studentId!)
          .eq("question_id", questionId!)
          .maybeSingle();
        if (error) console.warn("[board-session] load failed", error.message);
        if (applyRow(data)) return;
        // One-time migration read: work saved before per-question boards
        // existed lives in the legacy shared row. Only adopt it when it
        // belongs to THIS question, so nothing bleeds across questions.
        const { data: legacy } = await supabase
          .from("assessment_board_state")
          .select("state_json, question_id")
          .eq("assessment_id", assessmentId!)
          .eq("student_id", studentId!)
          .maybeSingle();
        const legacyQid = (legacy as { question_id?: string | null } | null)?.question_id ?? null;
        if (legacyQid && legacyQid === questionId) applyRow(legacy as never);
        return;
      }

      const { data, error } = await supabase
        .from("assessment_board_state")
        .select("state_json, author, updated_at")
        .eq("assessment_id", assessmentId!)
        .eq("student_id", studentId!)
        .maybeSingle();
      if (error) console.warn("[board-session] load failed", error.message);
      applyRow(data);
    })();

    return () => { cancelled = true; };
  }, [active, assessmentId, studentId, questionId, perQuestion]);


  // Live channel. Self-healing: a join can fail if the socket token was not
  // ready yet, which would otherwise kill mirroring for the whole session.
  // It also re-subscribes when the browser comes back online / the tab is
  // refocused, so neither side ever needs a manual page refresh.
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
            if (status === "SUBSCRIBED") {
              retries = 0;
              // Catch the other side up in one frame after a (re)join.
              const last = lastSnapshotRef.current;
              if (last) void ch.send({ type: "broadcast", event: "state", payload: last });
              return;
            }
            if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") && retries < 6) {
              retries += 1;
              supabase.removeChannel(ch);
              if (chanRef.current === ch) chanRef.current = null;
              window.setTimeout(() => { if (!cancelled) connect(); }, Math.min(3000, 400 * retries));
            }
          });
        chanRef.current = ch;
      });
    };
    connect();

    const revive = () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") return;
      const ch = chanRef.current;
      if (ch && ch.state === "joined") return;
      if (ch) {
        supabase.removeChannel(ch);
        chanRef.current = null;
      }
      retries = 0;
      connect();
    };
    window.addEventListener("online", revive);
    document.addEventListener("visibilitychange", revive);

    return () => {
      cancelled = true;
      window.removeEventListener("online", revive);
      document.removeEventListener("visibilitychange", revive);
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
    lastSnapshotRef.current = snapshot;

    // Fast path — broadcast (≈live TV latency). Kept at one frame so strokes,
    // drags, deletes and floating-number drops all stream without lag.
    if (bcTimer.current) window.clearTimeout(bcTimer.current);
    bcTimer.current = window.setTimeout(() => {
      const ch = chanRef.current;
      if (!ch) return;
      void ch.send({ type: "broadcast", event: "state", payload: snapshot });
    }, 30);


    // Durable path — debounced upsert. Errors are surfaced (they used to be
    // swallowed, which hid a missing-grant failure for the whole feature) and
    // retried once before giving up.
    if (dbTimer.current) window.clearTimeout(dbTimer.current);
    dbTimer.current = window.setTimeout(() => {
      const activeLine = Math.max(0, Math.floor(state.activeLineIdx ?? 0));
      const write = () =>
        perQuestion
          ? supabase
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
              )
          : supabase
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

      void write().then(({ error }) => {
        if (!error) return;
        console.warn("[board-session] save failed, retrying", error.message);
        void write().then(({ error: err2 }) => {
          if (err2) console.error("[board-session] save failed", err2.message);
        });
      });
    }, 700);
  }, [active, assessmentId, studentId, questionId, perQuestion, selfId]);


  useEffect(() => () => {
    if (bcTimer.current) window.clearTimeout(bcTimer.current);
    if (dbTimer.current) window.clearTimeout(dbTimer.current);
  }, []);

  return { sessionActive: active, selfId, incoming, push };
}
