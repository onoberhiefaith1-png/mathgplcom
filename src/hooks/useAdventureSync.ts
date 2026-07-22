// Live sync for a class + game: members, per-student scores, presence, and
// heartbeat-derived "in progress" state. Composes progress bars into per-bar
// summaries and per-student rows for the Adventure Dashboard. Ported additively
// from gameful for Phase 2 (Adventure → Game workflow).

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { assessmentPresenceTopic } from "@/lib/realtime/lessonPresence";
import { normalizeCanvas, type CanvasElement, type GameRow } from "@/lib/games/types";
import type { GameBoard } from "@/lib/games/gameQuestions";
import type { StudentProgressRow } from "@/components/dashboards/AssessmentStatusPanel";

export type ScoresByAssessment = Record<string, Record<string, number>>;
export type SolvedByAssessment = Record<string, Record<string, number>>;

export const ADVENTURE_HEARTBEAT_STALE_MS = 45_000;
const RECONCILE_MS = 15_000;

type Member = { user_id: string; display_name: string };
type ScoreRow = {
  assessment_id?: string;
  student_id?: string;
  score?: number;
  solved_lines?: Record<string, number> | null;
};
type ProfileNameRow = { user_id: string; display_name: string | null };

export type AdventureBarSummary = {
  id: string;
  label: string;
  total: number;
  goalPct: number;
  grand: number;
  required: number;
  achieved: number;
  segments: number;
  perSlot: string;
  students: number;
  assessmentId: string;
};

const idsKey = (ids: string[]) => ids.join("|");

const mergeScore = (
  prev: ScoresByAssessment,
  row: ScoreRow,
  allowed: Set<string>,
): ScoresByAssessment => {
  if (!row.assessment_id || !row.student_id || !allowed.has(row.assessment_id)) return prev;
  return {
    ...prev,
    [row.assessment_id]: {
      ...(prev[row.assessment_id] ?? {}),
      [row.student_id]: Number(row.score ?? 0),
    },
  };
};

export function useAdventureSync({
  classId,
  gameId,
  game,
  boards,
  currentUserId = null,
  onGameUpdated,
}: {
  classId: string | null | undefined;
  gameId: string | null | undefined;
  game: GameRow | null;
  boards: GameBoard[];
  currentUserId?: string | null;
  onGameUpdated?: (game: GameRow) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [scoresByAssessment, setScoresByAssessment] = useState<ScoresByAssessment>({});
  const [mySolvedByAssessment, setMySolvedByAssessment] = useState<SolvedByAssessment>({});
  const [presenceByAssessment, setPresenceByAssessment] = useState<Record<string, string[]>>({});
  const [heartbeatByAssessment, setHeartbeatByAssessment] = useState<Record<string, string[]>>({});

  const assessmentIds = useMemo(() => boards.map((b) => b.assessmentId).filter(Boolean), [boards]);
  const assessmentKey = idsKey(assessmentIds);
  const assessmentSet = useMemo(() => new Set(assessmentIds), [assessmentIds]);

  const refresh = useCallback(async () => {
    if (!classId || !gameId) return;
    const ids = assessmentKey ? assessmentKey.split("|").filter(Boolean) : [];

    const [membersResult, progressResult, sessionsResult] = await Promise.all([
      supabase.from("class_members").select("user_id").eq("class_id", classId),
      ids.length
        ? supabase
            .from("assessment_progress")
            .select("assessment_id, student_id, score, solved_lines")
            .in("assessment_id", ids)
        : Promise.resolve({ data: [] as ScoreRow[] }),
      supabase
        .from("adventure_live_sessions")
        .select("assessment_id, student_id, last_seen_at, is_active")
        .eq("class_id", classId)
        .eq("game_id", gameId)
        .eq("is_active", true)
        .gte("last_seen_at", new Date(Date.now() - ADVENTURE_HEARTBEAT_STALE_MS).toISOString()),
    ]);

    const memberRows = (membersResult.data ?? []) as Array<{ user_id: string }>;
    const memberUserIds = memberRows.map((r) => r.user_id);
    let nameByUser = new Map<string, string>();
    if (memberUserIds.length) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", memberUserIds);
      nameByUser = new Map(
        ((profileRows ?? []) as ProfileNameRow[]).map((p) => [p.user_id, p.display_name ?? "Student"]),
      );
    }
    setMembers(memberUserIds.map((uid) => ({ user_id: uid, display_name: nameByUser.get(uid) ?? "Student" })));

    const scoreMap: ScoresByAssessment = {};
    const mine: SolvedByAssessment = {};
    for (const r of progressResult.data ?? []) {
      const row = r as ScoreRow;
      if (!row.assessment_id || !row.student_id) continue;
      (scoreMap[row.assessment_id] ??= {})[row.student_id] = Number(row.score ?? 0);
      if (currentUserId && row.student_id === currentUserId) {
        mine[row.assessment_id] = (row.solved_lines ?? {}) as Record<string, number>;
      }
    }
    setScoresByAssessment(scoreMap);
    setMySolvedByAssessment(mine);

    const heartbeat: Record<string, Set<string>> = {};
    for (const r of sessionsResult.data ?? []) {
      const row = r as { assessment_id?: string; student_id?: string; last_seen_at?: string; is_active?: boolean };
      if (!row.assessment_id || !row.student_id || !row.is_active) continue;
      if (new Date(row.last_seen_at ?? 0).getTime() < Date.now() - ADVENTURE_HEARTBEAT_STALE_MS) continue;
      (heartbeat[row.assessment_id] ??= new Set()).add(row.student_id);
    }
    setHeartbeatByAssessment(Object.fromEntries(Object.entries(heartbeat).map(([k, v]) => [k, Array.from(v)])));
  }, [classId, gameId, assessmentKey, currentUserId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!classId || !gameId) return;
    const interval = window.setInterval(() => { void refresh(); }, RECONCILE_MS);
    const onWake = () => { void refresh(); };
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [classId, gameId, refresh]);

  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`adventure-sync-${classId}-${gameId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "assessment_progress" }, (payload) => {
          const row = (payload.new ?? payload.old) as ScoreRow | null;
          if (!row) return;
          setScoresByAssessment((prev) => mergeScore(prev, row, assessmentSet));
          if (currentUserId && row.student_id === currentUserId && row.assessment_id && row.solved_lines) {
            setMySolvedByAssessment((prev) => ({ ...prev, [row.assessment_id!]: row.solved_lines as Record<string, number> }));
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "class_members", filter: `class_id=eq.${classId}` }, () => {
          void refresh();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "adventure_live_sessions", filter: `class_id=eq.${classId}` }, (payload) => {
          const row = (payload.new ?? payload.old) as { game_id?: string } | null;
          if (!row || row.game_id === gameId) void refresh();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
          if (payload.new && onGameUpdated) onGameUpdated(payload.new as GameRow);
        })
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, gameId, assessmentSet, currentUserId, refresh, onGameUpdated]);

  useEffect(() => {
    if (!classId || assessmentIds.length === 0) return;
    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const perAssessment = new Map<string, Set<string>>();
    const recompute = () => {
      if (cancelled) return;
      setPresenceByAssessment(Object.fromEntries(Array.from(perAssessment.entries()).map(([k, v]) => [k, Array.from(v)])));
    };
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      for (const assessmentId of assessmentIds) {
        const ch = supabase.channel(assessmentPresenceTopic(classId, assessmentId), {
          config: { presence: { key: `observer-${assessmentId}` } },
        });
        const emit = () => {
          const state = ch.presenceState() as Record<string, Array<{ user_id?: string }>>;
          const set = new Set<string>();
          for (const key of Object.keys(state)) {
            if (key.startsWith("observer-")) continue;
            set.add(key);
            for (const meta of state[key]) if (meta.user_id) set.add(meta.user_id);
          }
          perAssessment.set(assessmentId, set);
          recompute();
        };
        ch
          .on("presence", { event: "sync" }, emit)
          .on("presence", { event: "join" }, emit)
          .on("presence", { event: "leave" }, emit)
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") { await ch.track({ role: "observer" }); emit(); }
          });
        channels.push(ch);
      }
    });
    return () => { cancelled = true; for (const ch of channels) supabase.removeChannel(ch); };
  }, [classId, assessmentKey, assessmentIds]);

  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);
  const activeSet = useMemo(() => {
    const merged = new Set<string>();
    for (const list of Object.values(presenceByAssessment)) for (const uid of list) merged.add(uid);
    for (const list of Object.values(heartbeatByAssessment)) for (const uid of list) merged.add(uid);
    return merged;
  }, [presenceByAssessment, heartbeatByAssessment]);

  const boardByElement = useMemo(() => new Map(boards.map((b) => [b.progressElementId, b])), [boards]);

  const barSummaries = useMemo<AdventureBarSummary[]>(() => {
    if (!game) return [];
    const canvas = normalizeCanvas(game.canvas);
    const scene = canvas.scenes.find((s) => s.id === canvas.activeSceneId) ?? canvas.scenes[0];
    const items: AdventureBarSummary[] = [];
    for (const el of scene?.elements ?? []) {
      if (el.kind !== "progress_bar") continue;
      const b = boardByElement.get(el.id);
      if (!b) continue;
      const total = b.totalMarks || 0;
      const segments = Math.max(1, Number(el.progress?.segments) || 10);
      const goalPct = Number(el.progress?.progressGoalPct ?? 100);
      const grand = total * memberIds.length;
      const required = Math.max(1, Math.round(grand * (goalPct / 100)));
      const scoresForBar = scoresByAssessment[b.assessmentId] ?? {};
      let collective = 0;
      for (const sid of Object.keys(scoresForBar)) if (memberSet.has(sid)) collective += scoresForBar[sid] ?? 0;
      const per = required / segments;
      items.push({
        id: el.id,
        label: el.label || "Progress Bar",
        total,
        goalPct,
        grand,
        required,
        achieved: Math.min(required, collective),
        segments,
        perSlot: Number.isInteger(per) ? String(per) : per.toFixed(1),
        students: memberIds.length,
        assessmentId: b.assessmentId,
      });
    }
    return items;
  }, [game, boardByElement, memberIds.length, scoresByAssessment, memberSet]);

  const elements = useMemo<CanvasElement[]>(() => {
    if (!game) return [];
    const statsById = new Map(barSummaries.map((b) => [b.id, b]));
    const canvas = normalizeCanvas(game.canvas);
    const scene = canvas.scenes.find((s) => s.id === canvas.activeSceneId) ?? canvas.scenes[0];
    return (scene?.elements ?? []).map((el) => {
      if (el.kind === "progress_bar" && el.progress) {
        const stats = statsById.get(el.id);
        if (stats) return { ...el, progress: { ...el.progress, totalMarks: stats.required, currentMarks: stats.achieved } };
      }
      return el;
    });
  }, [game, barSummaries]);

  const requiredContribution = useMemo(() => {
    if (memberIds.length <= 0) return 0;
    const totalRequired = barSummaries.reduce((sum, b) => sum + b.required, 0);
    return totalRequired / memberIds.length;
  }, [barSummaries, memberIds.length]);

  const rows = useMemo<StudentProgressRow[]>(() => {
    const totalMarks = boards.reduce((sum, b) => sum + (Number(b.totalMarks) || 0), 0);
    return members.map((m) => {
      let score = 0;
      for (const b of boards) score += scoresByAssessment[b.assessmentId]?.[m.user_id] ?? 0;
      const completed = requiredContribution > 0 && score >= requiredContribution;
      const active = activeSet.has(m.user_id);
      return {
        studentId: m.user_id,
        displayName: m.display_name,
        score,
        totalMarks,
        progressPct: totalMarks > 0 ? Math.min(100, (score / totalMarks) * 100) : 0,
        status: completed ? "completed" : active ? "in_progress" : "inactive",
        online: active,
      };
    });
  }, [members, boards, scoresByAssessment, requiredContribution, activeSet]);

  const achievedTotal = barSummaries.reduce((sum, b) => sum + b.achieved, 0);
  const requiredTotal = barSummaries.reduce((sum, b) => sum + b.required, 0);

  return {
    members,
    memberIds,
    memberSet,
    studentCount: memberIds.length,
    activeSet,
    scoresByAssessment,
    mySolvedByAssessment,
    boardByElement,
    barSummaries,
    elements,
    rows,
    achievedTotal,
    requiredTotal,
    requiredContribution,
    refresh,
  };
}
