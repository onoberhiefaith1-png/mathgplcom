// Live groups + memberships for one class+game. Any class member (teacher or
// student) can read groups and memberships via RLS, so this hook is used on
// both dashboards.

import { useTableChanges } from "@/lib/stability/useTableChanges";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  useTableChanges({
    name: `adventure-groups-${classId}-${gameId}`,
    enabled: !!classId && !!gameId,
    watch: [
      { table: "adventure_groups", filter: `class_id=eq.${classId}` },
      { table: "adventure_group_members", filter: `class_id=eq.${classId}` },
    ],
    onChange: () => void refresh(),
  });

  const studentGroup = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of members) if (row.game_id === gameId) m.set(row.student_id, row.group_id);
    return m;
  }, [members, gameId]);

  // Only legacy duplicated bars are "owned" by a group. In the scoreboard model
  // every group shares the one master bar, so nothing is owned.
  const barOwner = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) if (g.source_element_id) m.set(g.progress_element_id, g.id);
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
