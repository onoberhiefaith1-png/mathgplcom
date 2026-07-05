// Sensor parking — the ONE shared rule. The old 4-step capped walk left
// the sensor parked on a locked row once the board got dense (the
// "line 6+ nothing is clickable" bug). These tests pin the fix: the
// park row is NEVER a locked or inked row, no matter how many blocked
// rows sit below the ink.

import { describe, it, expect } from "vitest";
import { parkRowBelow } from "@/lib/smartboard/boardWriter/parkSensor";
import { rowIsBlocked, type BoardSnapshot } from "@/lib/smartboard/boardWriter/ledger";
import { planDirectWrite } from "@/lib/smartboard/boardWriter/directWrite";
import { mkChar, type Row } from "@/lib/smartboard/mathTree";

const inkRow = (text: string): Row => [...text].map((ch) => mkChar(ch));

const snapWith = (opts: {
  ink?: Record<number, Row>;
  locked?: number[];
}): BoardSnapshot => ({
  ink: opts.ink ?? {},
  rowOwners: {},
  lockedRows: new Set(opts.locked ?? []),
  bandStartRow: 0,
});

describe("parkRowBelow — uncapped, uniform for every line", () => {
  it("parks directly below the ink when nothing blocks (0 blocked rows)", () => {
    const snap = snapWith({ ink: { 5: inkRow("x=1") } });
    expect(parkRowBelow(snap, 5)).toBe(6);
  });

  it("skips 3 consecutive blocked rows", () => {
    const snap = snapWith({ ink: { 5: inkRow("x=1") }, locked: [6, 7, 8] });
    expect(parkRowBelow(snap, 5)).toBe(9);
  });

  it("skips 6 consecutive blocked rows (the old 4-step cap failed here)", () => {
    const snap = snapWith({
      ink: { 5: inkRow("x=1") },
      locked: [6, 7, 8, 9, 10, 11],
    });
    const parked = parkRowBelow(snap, 5);
    expect(parked).toBe(12);
    expect(rowIsBlocked(snap, parked)).toBe(false);
  });

  it("skips 12 mixed locked + inked rows and never lands on a blocked row", () => {
    const ink: Record<number, Row> = { 5: inkRow("x=1") };
    const locked: number[] = [];
    for (let r = 6; r <= 17; r++) {
      if (r % 2 === 0) ink[r] = inkRow("note");
      else locked.push(r);
    }
    const snap = snapWith({ ink, locked });
    const parked = parkRowBelow(snap, 5);
    expect(parked).toBe(18);
    expect(rowIsBlocked(snap, parked)).toBe(false);
  });

  it("is identical for a shallow line and a deep line (consistency law)", () => {
    // Same blocked pattern at two depths → same relative park offset.
    const shallow = snapWith({ ink: { 2: inkRow("a") }, locked: [3, 4] });
    const deep = snapWith({ ink: { 40: inkRow("a") }, locked: [41, 42] });
    expect(parkRowBelow(shallow, 2) - 2).toBe(parkRowBelow(deep, 40) - 40);
  });
});

describe("planDirectWrite — sensorRow is never blocked", () => {
  it("note landing above 6 locked rows still parks on a free row", () => {
    // Note will land at row 5 (first free), rows 6..11 already locked.
    const snap = snapWith({ locked: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11] });
    const plan = planDirectWrite(snap, 0, "square root of 49 is 7");
    expect(plan).not.toBeNull();
    expect(plan!.landedRow).toBe(5);
    expect(plan!.sensorRow).toBe(12);
    expect(rowIsBlocked(snap, plan!.sensorRow)).toBe(false);
  });

  it("multi-paragraph note parks below ALL its own rows and existing locks", () => {
    const snap = snapWith({ locked: [3, 4, 5, 6, 7] });
    const plan = planDirectWrite(snap, 1, "first line\nsecond line");
    expect(plan).not.toBeNull();
    const rows = plan!.rows.map((r) => r.row);
    expect(rows).toEqual([1, 2]);
    expect(plan!.sensorRow).toBe(8);
  });
});
