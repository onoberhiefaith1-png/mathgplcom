import { describe, it, expect } from "vitest";
import {
  rankBests, isStrictlyFaster, myPosition, sectorAngle, wheelPages, verifiedElapsed, cleanDisplayName,
  type ArenaBest,
} from "@/lib/arena/ranking";

const b = (id: string, ms: number, at: string): ArenaBest => ({ participantId: id, bestMs: ms, achievedAt: at, attemptId: `a-${id}` });

describe("Timer Arena ranking", () => {
  it("on an exact tie the earlier achiever stays ahead", () => {
    const r = rankBests([b("ben", 8200, "2026-10-15T10:00:05Z"), b("ada", 8200, "2026-10-15T10:00:01Z")]);
    expect(r.map((x) => x.participantId)).toEqual(["ada", "ben"]);
  });
  it("a strictly faster time takes first place", () => {
    const r = rankBests([b("ada", 8200, "2026-10-15T10:00:01Z"), b("tina", 8190, "2026-10-15T10:05:00Z")]);
    expect(r[0]!.participantId).toBe("tina");
  });
  it("only a strictly faster time replaces a personal best", () => {
    expect(isStrictlyFaster(8200, 8200)).toBe(false);
    expect(isStrictlyFaster(8200, 9000)).toBe(false);
    expect(isStrictlyFaster(8200, 8199)).toBe(true);
    expect(isStrictlyFaster(null, 8200)).toBe(true);
  });
  it("position, gap to next place and gap to the Top 5", () => {
    const rows = rankBests([1000, 2000, 3000, 4000, 5000, 6000, 7000].map((ms, i) => b(`p${i}`, ms, "2026-10-15T10:00:00Z")));
    const p = myPosition(rows, "p6");
    expect(p).toMatchObject({ ranked: true, place: 7, rankedCount: 7, behindNextMs: 1000, toTopFiveMs: 2001 });
    expect(myPosition(rows, "p0")).toMatchObject({ champion: true, behindNextMs: null, toTopFiveMs: null });
    expect(myPosition(rows, "nobody")).toEqual({ ranked: false, rankedCount: 7 });
  });
  it("groups never mix: ranking only sees the rows it is given", () => {
    const groupA = [b("a1", 9000, "2026-10-15T10:00:00Z")];
    expect(myPosition(rankBests(groupA), "b1")).toEqual({ ranked: false, rankedCount: 1 });
  });
  it("wheel slices are 360 ÷ questions", () => {
    expect(sectorAngle(3)).toBe(120);
    expect(sectorAngle(6)).toBe(60);
    expect(sectorAngle(8)).toBe(45);
  });
  it("long sessions split into wheel pages of 8", () => {
    const pages = wheelPages(Array.from({ length: 12 }, (_, i) => i));
    expect(pages.map((p) => p.label)).toEqual(["Q1–8", "Q9–12"]);
  });
  it("a device time faster than the server clock allows is replaced by the server time", () => {
    expect(verifiedElapsed(8000, 9000)).toBe(8000);
    expect(verifiedElapsed(2000, 30000)).toBe(2000);
    expect(verifiedElapsed(50000, 9000)).toBe(9000);
  });
  it("blocks inappropriate names", () => {
    expect(cleanDisplayName("Ada")).toBe("Ada");
    expect(cleanDisplayName("sh it")).toBeNull();
    expect(cleanDisplayName(" ")).toBeNull();
  });
});
