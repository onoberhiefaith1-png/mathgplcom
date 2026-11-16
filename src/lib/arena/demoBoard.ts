import type { ArenaBoard } from "@/lib/arena/arenaClient";
import { DEFAULT_GRAPH_TABLE } from "@/lib/graphActivity/table";

/** Local screenshot / preview board for /arena/live/DEMO — never hits the network. */
export const isDemoArenaCode = (code: string | undefined) => (code ?? "").toUpperCase() === "DEMO";

export function demoArenaBoard(): ArenaBoard {
  return {
    shareId: "demo-share",
    title: "Graph preview",
    status: "open",
    sessionTitle: "Live Report",
    crumbs: {},
    joined: 3,
    online: 2,
    rankedParticipants: 2,
    generatedAt: new Date().toISOString(),
    columns: [
      {
        number: 1,
        activityId: "demo-a1",
        assessmentId: "demo-q1",
        title: "Question 1",
        rankedCount: 2,
        timerEnabled: true,
        photosEnabled: false,
        top: [
          { participantId: "p1", place: 1, name: "Ada", avatar: null, ms: 4120 },
          { participantId: "p2", place: 2, name: "Ben", avatar: null, ms: 5800 },
        ],
      },
      {
        number: 2,
        activityId: "demo-a2",
        assessmentId: "demo-q2",
        title: "Question 2",
        rankedCount: 1,
        timerEnabled: true,
        photosEnabled: false,
        top: [{ participantId: "p1", place: 1, name: "Ada", avatar: null, ms: 7000 }],
      },
    ],
    participants: [
      { id: "p1", name: "Ada", avatar: null, photo: null, presence: "active", lastSeenAt: Date.now(), working: 2, ranked: 2, joinedAt: Date.now() - 60_000 },
      { id: "p2", name: "Ben", avatar: null, photo: null, presence: "active", lastSeenAt: Date.now(), working: 1, ranked: 1, joinedAt: Date.now() - 50_000 },
      { id: "p3", name: "Cara", avatar: null, photo: null, presence: "inactive", lastSeenAt: Date.now() - 20_000, working: null, ranked: 0, joinedAt: Date.now() - 40_000 },
    ],
    participantsTotal: 3,
    overallChampions: [
      { participantId: "p1", name: "Ada", averageMs: 5560, totalMs: 11120, completedAt: new Date().toISOString(), place: 1 },
    ],
    completedAll: 0,
    graphTable: DEFAULT_GRAPH_TABLE,
  } as ArenaBoard & { graphTable: typeof DEFAULT_GRAPH_TABLE };
}
