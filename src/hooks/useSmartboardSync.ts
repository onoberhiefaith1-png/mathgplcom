// Live SmartBoard mirroring. A teacher's board is the source of truth; it
// serializes its presentation state into class_smartboard_state.state_json.
// Students subscribe and apply that state read-only — unless the teacher has
// made them the single "active student", in which case their edits are pushed
// back into the same row (teacher always retains control).

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BoardSnapshot = {
  v: number;
  author: string;
  ts: number;
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
};

export type BoardState = Omit<BoardSnapshot, "v" | "author" | "ts">;

export function useSmartboardSync(opts: {
  classId?: string | null;
  role: "teacher" | "student";
}) {
  const { classId } = opts;
  const enabled = !!classId;

  const [selfId, setSelfId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<BoardSnapshot | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const pushTimer = useRef<number | null>(null);
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setSelfId(data.user?.id ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;

    const apply = (row: { state_json?: unknown; active_student_id?: string | null } | null) => {
      if (!row) return;
      setActiveStudentId(row.active_student_id ?? null);
      const sj = row.state_json;
      if (sj && typeof sj === "object") setIncoming(sj as BoardSnapshot);
    };

    supabase
      .from("class_smartboard_state")
      .select("state_json, active_student_id")
      .eq("class_id", classId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) apply(data as never); });

    const ch = supabase
      .channel(`sb-sync-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_smartboard_state", filter: `class_id=eq.${classId}` },
        (payload: { new?: unknown }) => apply((payload.new ?? null) as never),
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [classId]);

  const pushSnapshot = useCallback((state: BoardState) => {
    if (!classId || !selfId) return;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(async () => {
      // De-dupe identical content (ignore timestamp) to avoid noisy writes.
      const fingerprint = JSON.stringify(state);
      if (fingerprint === lastSentRef.current) return;
      lastSentRef.current = fingerprint;
      const full: BoardSnapshot = { v: 1, author: selfId, ts: Date.now(), ...state };
      await supabase
        .from("class_smartboard_state")
        .update({ state_json: full as never, updated_at: new Date().toISOString() })
        .eq("class_id", classId);
    }, 180);
  }, [classId, selfId]);

  const setActiveStudent = useCallback(async (uid: string | null) => {
    if (!classId) return;
    await supabase
      .from("class_smartboard_state")
      .update({ active_student_id: uid })
      .eq("class_id", classId);
    setActiveStudentId(uid);
  }, [classId]);

  return { enabled, selfId, incoming, activeStudentId, pushSnapshot, setActiveStudent };
}
