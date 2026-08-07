// Outcome of a group competition — one rule per game mode.
//
// Adventure is a race: the first group whose Learning Progress Bar fills wins
// immediately and the game ends.
//
// Video Adventure is a journey: reaching 100% first changes nothing on its own.
// When the Learning Point's Time Progress Bar runs out every group is judged
// once — groups on target travel on, the others stay behind and watch, and the
// teacher's encouraging message is shown to them instead of a failure notice.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GROUP_COMPLETION_MESSAGE,
  getGroupCompletionMessage,
  recordRaceWinner,
  type AdventureGroup,
} from "@/lib/adventures/groups";
import { evaluateCheckpoint, raceWinner } from "@/lib/adventures/groupCompetition";


export type GroupOutcome = {
  /** Adventure only — the group that finished first, if any. */
  winner: AdventureGroup | null;
  /** Video Adventure — groups that missed the target of a Learning Point. */
  waitingGroupIds: Set<string>;
  /** Teacher-editable encouragement shown to a waiting group. */
  message: string;
};

export function useGroupOutcome(params: {
  classId: string | null | undefined;
  gameId: string | null | undefined;
  /** "static" = Adventure race, "video" = Video Adventure journey. */
  mode: "static" | "video";
  /** Active Learning Point (Video Adventure only). */
  sceneId?: string | null;
  groups: AdventureGroup[];
  /** groupId → 0…1 progress against this Learning Point's required mark. */
  fillByGroup: Map<string, number>;
  timeExpired: boolean;
  /** Only the teacher dashboard should write outcomes. */
  authoritative?: boolean;
  /** Changes on Restart Game so every Learning Point is judged again. */
  runKey?: string | null;
  onChanged?: () => void;
}): GroupOutcome {
  const { classId, gameId, mode, sceneId, groups, fillByGroup, timeExpired, authoritative, runKey, onChanged } = params;
  const [message, setMessage] = useState(DEFAULT_GROUP_COMPLETION_MESSAGE);
  const winnerWrittenRef = useRef<string | null>(null);
  const judgedSceneRef = useRef<string | null>(null);

  // A replay judges from live data: forget what the previous run decided.
  useEffect(() => {
    winnerWrittenRef.current = null;
    judgedSceneRef.current = null;
  }, [runKey]);

  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    void getGroupCompletionMessage(classId, gameId).then((m) => { if (!cancelled) setMessage(m); });
    return () => { cancelled = true; };
  }, [classId, gameId]);



  const winner = useMemo(
    () => (mode === "static" ? raceWinner(groups, fillByGroup) : null),
    [mode, groups, fillByGroup],
  );

  // Adventure — remember the winner so the dashboard and students agree.
  useEffect(() => {
    if (!authoritative || mode !== "static" || !classId || !gameId) return;
    if (!winner || winnerWrittenRef.current === winner.id) return;
    winnerWrittenRef.current = winner.id;
    void recordRaceWinner(classId, gameId, winner.id).then(() => onChanged?.()).catch(() => {
      winnerWrittenRef.current = null;
    });
  }, [authoritative, mode, classId, gameId, winner, onChanged]);

  // Video Adventure — judge the Learning Point exactly once, when time is up.
  useEffect(() => {
    if (!authoritative || mode !== "video" || !timeExpired) return;
    const scene = sceneId ?? "";
    if (!scene || judgedSceneRef.current === scene || groups.length === 0) return;
    judgedSceneRef.current = scene;
    void evaluateCheckpoint({ sceneId: scene, groups, fillByGroup })
      .then(() => onChanged?.())
      .catch(() => { judgedSceneRef.current = null; });
  }, [authoritative, mode, timeExpired, sceneId, groups, fillByGroup, onChanged]);

  const waitingGroupIds = useMemo(
    () => new Set(groups.filter((g) => !g.qualified).map((g) => g.id)),
    [groups],
  );

  return { winner, waitingGroupIds, message };
}
