// Group Competition Board — live standings computed from ONE master Progress
// Bar.
//
// Nothing is duplicated on the stage: every group points at the same master bar
// (the same Lesson Note, the same questions, the same rules). A group's numbers
// are simply the master bar's rules applied to the students assigned to it, so
// moving a student between groups moves their marks with them.

import type { AdventureGroup } from "./groups";
import type { GroupStatus } from "./groupCompetition";
import { groupStatus } from "./groupCompetition";

/** The master bar's definition — the only source of gameplay rules. */
export type MasterBar = {
  id: string;
  label: string;
  assessmentId: string;
  /** Marks one student can earn on this bar. */
  total: number;
  /** Progress goal of the bar itself, in percent. */
  goalPct: number;
  segments: number;
};

export type GroupStanding = {
  group: AdventureGroup;
  students: number;
  /** Total marks available to this group (per-student marks × students). */
  grand: number;
  /** Marks this group must reach for this Learning Point. */
  required: number;
  achieved: number;
  /** 0…1 of `required`. */
  fill: number;
  status: GroupStatus;
};

export function computeGroupStandings(params: {
  groups: AdventureGroup[];
  studentsByGroup: Map<string, Set<string>>;
  master: MasterBar | null;
  /** assessmentId → studentId → marks. */
  scores: Record<string, Record<string, number>>;
  /** Required mark of the current Learning Point, in percent (100 for Adventure). */
  requiredPct?: number;
  mode: "static" | "video";
  winnerGroupId?: string | null;
}): GroupStanding[] {
  const { groups, studentsByGroup, master, scores, mode, winnerGroupId } = params;
  const pct = Math.min(100, Math.max(1, Math.round(params.requiredPct ?? 100)));
  const raw = master ? scores[master.assessmentId] ?? {} : {};

  return groups.map((group) => {
    const ids = studentsByGroup.get(group.id) ?? new Set<string>();
    const students = ids.size;
    const perStudent = master?.total ?? 0;
    const grand = perStudent * students;
    const goal = master ? grand * (master.goalPct / 100) : 0;
    const required = Math.max(1, Math.round((goal * pct) / 100));
    let sum = 0;
    for (const sid of ids) sum += raw[sid] ?? 0;
    const achieved = Math.min(required, sum);
    const fill = required > 0 ? achieved / required : 0;
    return {
      group,
      students,
      grand,
      required,
      achieved,
      fill,
      status: groupStatus({ group, fill, mode, winnerGroupId }),
    };
  });
}

/** groupId → 0…1 fill, for the outcome rules. */
export const fillByGroupOf = (standings: GroupStanding[]): Map<string, number> =>
  new Map(standings.map((s) => [s.group.id, s.fill]));
