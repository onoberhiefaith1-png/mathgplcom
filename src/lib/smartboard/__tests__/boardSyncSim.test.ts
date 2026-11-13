// Many simulated students on a simulated network: the previous protocol (v1)
// against the new one (v2) on identical traffic.
import { describe, expect, it } from "vitest";
import { runScenario } from "@/lib/smartboard/sim/boardSyncSim";

describe("classroom board sync, simulated class", () => {
  it("late joiner while the teacher is idle: v2 syncs as soon as the lesson loads; v1 waited for the slow poll", async () => {
    const sc = { students: 10, durationMs: 45_000, joinAt: () => 30_000, activity: { kind: "idle-after" as const, at: 29_000 }, lessonLoadMs: 800 };
    const v1 = await runScenario({ ...sc, protocol: "v1" });
    const v2 = await runScenario({ ...sc, protocol: "v2" });
    expect(v2.joinToSyncMs.neverSynced).toBe(0);
    expect(v2.joinToSyncMs.max).toBeLessThanOrEqual(1300);
    expect(v1.joinToSyncMs.median).toBeGreaterThan(5000);
  });

  it("teacher skipped a slide in Preview: v1 students never sync, v2 students do", async () => {
    const sc = { students: 10, durationMs: 20_000, teacherSkipped: ["beat-3"] };
    const v1 = await runScenario({ ...sc, protocol: "v1" });
    const v2 = await runScenario({ ...sc, protocol: "v2" });
    expect(v1.joinToSyncMs.neverSynced).toBe(10);
    expect(v2.joinToSyncMs.neverSynced).toBe(0);
    expect(v2.outOfSync).toBeLessThan(0.005);
  });

  it("good connection (0.2% loss): students stay on the teacher's board, nearly all the time", async () => {
    const r = await runScenario({ protocol: "v2", students: 30, durationMs: 60_000 });
    expect(r.joinToSyncMs.neverSynced).toBe(0);
    expect(r.outOfSync).toBeLessThan(0.003);
    expect(r.longestDriftMs).toBeLessThanOrEqual(500);
  });

  it("100 students on a 500 events/s plan: v2 stays inside the budget (no channel closures); v1 does not", async () => {
    const sc = { students: 100, durationMs: 90_000, net: { budget: 500 } };
    const v1 = await runScenario({ ...sc, protocol: "v1" });
    const v2 = await runScenario({ ...sc, protocol: "v2" });
    expect(v1.channelClosures).toBeGreaterThan(0);
    expect(v2.channelClosures).toBe(0);
    expect(v2.outOfSync).toBeLessThan(0.01);
  }, 30_000);

  it("a student who was offline is back on the board within about a second of reconnecting", async () => {
    const r = await runScenario({ protocol: "v2", students: 5, durationMs: 40_000, activity: { kind: "constant" }, outages: [[0, 10_000, 20_000], [1, 15_000, 16_000]] });
    expect(r.resyncAfterReconnectMs).toHaveLength(2);
    for (const ms of r.resyncAfterReconnectMs) expect(ms).toBeLessThanOrEqual(1200);
  });
});
