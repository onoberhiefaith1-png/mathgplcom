// Run: npx tsx scripts/board-sync-sim.ts  (prints before/after numbers)
import { runScenario, type Scenario } from "../src/lib/smartboard/sim/boardSyncSim";

const rows: Array<Record<string, unknown>> = [];
const run = async (name: string, sc: Omit<Scenario, "protocol">) => {
  for (const protocol of ["v1", "v2"] as const) {
    const t0 = Date.now();
    const r = await runScenario({ ...sc, protocol });
    rows.push({ scenario: name, ...r, joinToSyncMs: `${r.joinToSyncMs.median} / ${r.joinToSyncMs.p95} / ${r.joinToSyncMs.max} (never ${r.joinToSyncMs.neverSynced})`, outOfSync: `${(r.outOfSync * 100).toFixed(2)}%`, simMs: Date.now() - t0 });
    console.error(name, protocol, "done");
  }
};
const only = process.argv[2];
const want = (n: string) => !only || only.split(",").includes(n);

if (want("late-idle")) await run("late-idle", { students: 20, durationMs: 60_000, joinAt: () => 30_000, activity: { kind: "idle-after", at: 29_000 } });
if (want("late-active")) await run("late-active", { students: 20, durationMs: 60_000, joinAt: (i) => 20_000 + i * 1500 });
if (want("plan")) await run("plan", { students: 20, durationMs: 40_000, teacherSkipped: ["beat-3"] });
if (want("lossy")) await run("lossy", { students: 30, durationMs: 120_000, net: { dropRate: 0.02, reorderRate: 0.02 } });
if (want("reconnect")) await run("reconnect", { students: 10, durationMs: 60_000, activity: { kind: "constant" }, outages: [[0, 20_000, 30_000], [1, 25_000, 26_000], [2, 40_000, 52_000]] });
if (want("pro-30")) await run("pro-30", { students: 30, durationMs: 120_000, net: { budget: 500 } });
if (want("pro-100")) await run("pro-100", { students: 100, durationMs: 120_000, net: { budget: 500 } });
if (want("team-1000")) await run("team-1000", { students: 1000, durationMs: 90_000, sampleMs: 250, net: { budget: 2500 } });
if (want("sfu-1000")) await run("sfu-1000", { students: 1000, durationMs: 90_000, sampleMs: 250, net: { budget: 0 } });

console.table(rows.map(({ scenario, protocol, students, joinToSyncMs, outOfSync, longestDriftMs, eventsPerSecondAvg, eventsPerSecondPeak, channelClosures, rowReads, wantsSent, simMs, resyncAfterReconnectMs }) =>
  ({ scenario, protocol, students, "join→sync ms (med/p95/max)": joinToSyncMs, outOfSync, longestDriftMs, "ev/s avg": eventsPerSecondAvg, "ev/s peak": eventsPerSecondPeak, closures: channelClosures, rowReads, wants: wantsSent, reconnect: (resyncAfterReconnectMs as number[]).join(" "), simMs })));
console.log(JSON.stringify(rows));
