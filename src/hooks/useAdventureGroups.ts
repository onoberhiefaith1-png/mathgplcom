// Live groups + memberships for one class+game. Any class member (teacher or
// student) can read groups and memberships via RLS, so this hook is used on
// both dashboards.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import {
  listGroupMembers,
  listGroups,
  type AdventureGroup,
  type AdventureGroupMember,
} from "@/lib/adventures/groups";

export type GroupContext = {
  groups: AdventureGroup[];
  members: AdventureGroupMember[];
  /** studentId → groupId (or undefined for Whole Class). */
  studentGroup: Map<string, string>;
  /** barElementId → groupId (owner). */
  barOwner: Map<string, string>;
  /** groupId → set of studentIds in that group. */
  studentsByGroup: Map<string, Set<string>>;
  refresh: () => Promise<void>;
};

export function useAdventureGroups(
  classId: string | null | undefined,
  gameId: string | null | undefined,
): GroupContext {
  const [groups, setGroups] = useState<AdventureGroup[]>([]);
  const [members, setMembers] = useState<AdventureGroupMember[]>([]);

  const refresh = useCallback(async () => {
    if (!classId || !gameId) { setGroups([]); setMembers([]); return; }
    const [g, m] = await Promise.all([listGroups(classId, gameId), listGroupMembers(classId, gameId)]);
    setGroups(g);
    setMembers(m);
  }, [classId, gameId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`adventure-groups-${classId}-${gameId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "adventure_groups", filter: `class_id=eq.${classId}` }, () => { void refresh(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "adventure_group_members", filter: `class_id=eq.${classId}` }, () => { void refresh(); })
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, gameId, refresh]);

  const studentGroup = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of members) if (row.game_id === gameId) m.set(row.student_id, row.group_id);
    return m;
  }, [members, gameId]);

  const barOwner = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) m.set(g.progress_element_id, g.id);
    return m;
  }, [groups]);

  const studentsByGroup = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const g of groups) m.set(g.id, new Set());
    for (const row of members) {
      const s = m.get(row.group_id) ?? new Set<string>();
      s.add(row.student_id);
      m.set(row.group_id, s);
    }
    return m;
  }, [groups, members]);

  return { groups, members, studentGroup, barOwner, studentsByGroup, refresh };
}
